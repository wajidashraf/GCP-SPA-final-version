import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';

const root = new URL('../', import.meta.url);
const read = (path: string) => readFileSync(new URL(path, root), 'utf8');
const walkFiles = (directory: string): string[] => readdirSync(new URL(directory, root), { withFileTypes: true })
  .flatMap((entry) => entry.isDirectory() ? walkFiles(`${directory}/${entry.name}`) :
    /\.tsx?$/.test(entry.name) ? [`${directory}/${entry.name}`] : []);

// Logical names are taken from the existing table services, settings, and
// requestChildSources.ts. Entity-set names are read from each service below.
export const tableSources = {
  account: 'account', contact: 'contact', gcp_request: 'request',
  gcp_projects: 'project', gcp_engagements: 'engagement', gcp_slot: 'slot',
  gcp_emailtemplate: 'emailTemplate', gcp_rtprequest: 'rtpRequest',
  gcp_pblrequest: 'pblRequest', gcp_pblbidders: 'pblBidder',
  gcp_jvmrequest: 'jvpRequest', gcp_stsprequest: 'stspRequest',
  gcp_caarequest: 'caaRequest', gcp_pccarequest: 'pccaRequest',
  gcp_pprequest: 'ppRequest', gcp_vaprequest: 'vapRequest',
  gcp_otherrequests: 'otherRequest', gcp_cprrequestgcp: 'cprRequest',
  gcp_requestcigcp: 'ciRequest', gcp_rpccarequestgcp: 'rpccaRequest',
  gcp_rpprequest: 'rppRequest', gcp_signature: 'signature',
  gcp_suggestion: 'suggestion',
};

export type ColumnUse = {
  table: string;
  column: string;
  kind: 'write' | 'read/query' | 'contract';
  source: string;
  line: number;
};

const parse = (path: string) => ts.createSourceFile(path, read(path), ts.ScriptTarget.Latest, true);
const propertyName = (name: ts.PropertyName | undefined): string | undefined =>
  name && (ts.isIdentifier(name) || ts.isStringLiteral(name)) ? name.text : undefined;
const systemColumns = new Set([
  'accountid', 'accountnumber', 'name', 'parentaccountid', 'contactid',
  'emailaddress1', 'fullname', 'firstname', 'lastname', 'telephone1', 'parentcustomerid_account',
  '_parentaccountid_value', '_parentcustomerid_value', 'createdon', 'modifiedon',
  'statecode', 'statuscode',
]);

/**
 * Inventory actual source contracts and requests, preserving OData spelling.
 * This intentionally does not infer names from schema names or lower-case binds.
 * It is a source regression check, not a claim about current deployed metadata.
 */
export const inventoryWebApiColumns = (): ColumnUse[] => {
  const uses: ColumnUse[] = [];
  const files = new Map<string, ts.SourceFile>();
  const getFile = (path: string) => {
    const source = files.get(path) ?? parse(path);
    files.set(path, source);
    return source;
  };
  const entitySets = new Set(Object.values(tableSources).map((stem) => {
    const source = read(`src/shared/services/${stem}Service.ts`);
    return source.match(/const ENTITY_SET = '([^']+)'/)?.[1] ?? '';
  }));
  const isColumn = (value: string) =>
    !entitySets.has(value) &&
    (/^_?gcp_[A-Za-z0-9_]+$/.test(value) || systemColumns.has(value));
  const add = (table: string, value: string, node: ts.Node, kind: ColumnUse['kind']) => {
    const column = value.replace(/@odata\.bind$/, '');
    if (!isColumn(column)) return;
    const source = node.getSourceFile();
    uses.push({ table, column, kind, source: source.fileName,
      line: source.getLineAndCharacterOfPosition(node.getStart()).line + 1 });
  };
  const strings = (table: string, node: ts.Node, kind: ColumnUse['kind']) => {
    if (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) || ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) {
      for (const match of node.text.matchAll(/\b_?gcp_[A-Za-z0-9_]+(?:@odata\.bind)?\b|\b[A-Za-z_][A-Za-z0-9_]*\b/g)) {
        add(table, match[0], node, kind !== 'contract' && match[0].endsWith('@odata.bind') ? 'write' : kind);
      }
    }
  };
  const ancestors = (node: ts.Node): ts.Node[] => {
    const result: ts.Node[] = [];
    for (let parent = node.parent; parent; parent = parent.parent) result.push(parent);
    return result;
  };
  const scan = (path: string, table: string, isType = false) => {
    const source = getFile(path);
    const visit = (node: ts.Node) => {
      // completeReview writes the parent request from the signature service.
      const target = path.endsWith('/signatureService.ts') && ancestors(node).some((parent) =>
        ts.isVariableDeclaration(parent) && ts.isIdentifier(parent.name) && parent.name.text === 'completeReview')
        ? 'gcp_request' : table;
      const chain = ancestors(node);
      const inputContract = chain.some((parent) => ts.isTypeAliasDeclaration(parent) && /^(Create|Update)/.test(parent.name.text));
      const projection = chain.some((parent) => ts.isVariableDeclaration(parent) &&
        ts.isIdentifier(parent.name) && /SELECT$/.test(parent.name.text));
      const query = chain.some((parent) => ts.isPropertyAssignment(parent) &&
        ['select', 'filter', 'orderby', 'expand'].includes(propertyName(parent.name) ?? ''));
      if (!isType || inputContract || projection || query) {
        const dynamicWrite = chain.some((parent) => ts.isVariableDeclaration(parent) &&
          ts.isIdentifier(parent.name) && /^ATTENDEE_(BINDS|NAV_PROPS|EMAIL_COLS)$/.test(parent.name.text));
        strings(target, node, inputContract ? 'contract' : dynamicWrite ? 'write' : 'read/query');
        if (ts.isPropertyAssignment(node) || (inputContract && ts.isPropertySignature(node))) {
          add(target, propertyName(node.name) ?? '', node, inputContract ? 'contract' : 'write');
        }
        if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken) {
          const left = node.left;
          if (ts.isPropertyAccessExpression(left)) add(target, left.name.text, left, 'write');
          if (ts.isElementAccessExpression(left) && ts.isStringLiteralLike(left.argumentExpression)) {
            add(target, left.argumentExpression.text, left, 'write');
          }
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  };
  for (const [table, stem] of Object.entries(tableSources)) {
    scan(`src/shared/services/${stem}Service.ts`, table);
    if (!['signature', 'suggestion'].includes(stem)) scan(`src/types/${stem}.ts`, table, true);
  }
  for (const path of ['acceptReviewPayload', 'reviewerCommentPayload', 'requestEditPolicy']) {
    scan(`src/shared/${path}.ts`, 'gcp_request');
  }

  // Shared child-list code contributes a createdon order-by to every child.
  // Lookup-only integrity/deletion queries use this canonical source registry.
  const childSource = getFile('src/shared/requestChildSources.ts');
  const visitChild = (node: ts.Node) => {
    if (ts.isObjectLiteralExpression(node)) {
      const properties = new Map(node.properties.filter(ts.isPropertyAssignment).map((property) =>
        [propertyName(property.name), property.initializer]));
      const logicalName = properties.get('logicalName');
      if (logicalName && ts.isStringLiteral(logicalName)) {
        for (const key of ['idField', 'parentField']) {
          const field = properties.get(key);
          if (field && ts.isStringLiteral(field)) add(logicalName.text, field.text, field, 'read/query');
        }
        if (logicalName.text !== 'gcp_pblbidders') add(logicalName.text, 'createdon', node, 'read/query');
      }
    }
    ts.forEachChild(node, visitChild);
  };
  visitChild(childSource);

  // Audit options/payloads supplied by callers as well as service defaults.
  // Resolve local variables to catch `listRequests({ filter })`, parentInput,
  // childInput, and other arguments assembled before the service call.
  const moduleTables = new Map(Object.entries(tableSources).map(([table, stem]) => [`${stem}Service`, table]));
  moduleTables.set('useRequests', 'gcp_request');
  moduleTables.set('useAccount', 'account');
  for (const path of walkFiles('src')) {
    const source = getFile(path);
    const calls = new Map<string, string>();
    const variables = new Map<string, ts.Expression>();
    const index = (node: ts.Node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
        const module = node.moduleSpecifier.text.split('/').at(-1)?.replace(/\.tsx?$/, '');
        const table = moduleTables.get(module ?? '');
        const imports = node.importClause?.namedBindings;
        if (table && imports && ts.isNamedImports(imports)) {
          for (const imported of imports.elements) calls.set(imported.name.text, table);
        }
      }
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.initializer) {
        variables.set(node.name.text, node.initializer);
      }
      ts.forEachChild(node, index);
    };
    index(source);
    const inspect = (table: string, node: ts.Node, seen: Set<string>) => {
      // Arguments such as parentResult.id are values, not a new request body.
      // Following their initializer into another service call confuses tables.
      if (ts.isCallExpression(node) || ts.isPropertyAccessExpression(node) || ts.isElementAccessExpression(node)) return;
      strings(table, node, 'read/query');
      if (ts.isPropertyAssignment(node) && propertyName(node.name)?.startsWith('gcp_')) {
        add(table, propertyName(node.name)!, node, 'write');
      }
      if (ts.isIdentifier(node) && !seen.has(node.text) && variables.has(node.text)) {
        const next = new Set(seen).add(node.text);
        inspect(table, variables.get(node.text)!, next);
      }
      ts.forEachChild(node, (child) => inspect(table, child, seen));
    };
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const table = calls.get(node.expression.text);
        if (table) for (const argument of node.arguments) inspect(table, argument, new Set());
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return [...new Map(uses.map((use) => [JSON.stringify(use), use])).values()];
};

// There are currently no executable expansions. A future expansion must map
// nested $select/$filter fields to its related table rather than the root table.
// Fail visibly until that target-aware audit is added, instead of passing on
// the misleading assumption that every nested column belongs to the root.
export const unsupportedWebApiExpansions = (): string[] => {
  const expansions: string[] = [];
  for (const path of walkFiles('src')) {
    if (path === 'src/shared/powerPagesApi.ts') continue; // Generic query serializer.
    const source = parse(path);
    const visit = (node: ts.Node) => {
      const isExpand = ts.isPropertyAssignment(node) && propertyName(node.name) === 'expand';
      const isUrlExpand = (ts.isStringLiteralLike(node) || ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) || ts.isTemplateTail(node)) && node.text.includes('$expand=');
      if (isExpand || isUrlExpand) {
        expansions.push(`${path}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`);
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return expansions;
};
