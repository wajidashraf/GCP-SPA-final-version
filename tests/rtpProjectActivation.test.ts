import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getVerificationSubmissionPresentation,
  isRtpFrVerification,
  submitVerificationWithRtpProjectActivation,
} from '../src/shared/rtpProjectActivation.ts';
import {
  mapGcpProject,
  PROJECT_STATUS,
} from '../src/types/project.ts';
import type { GcpProject } from '../src/types/project.ts';
import { invalidateAntiForgeryToken } from '../src/shared/powerPagesApi.ts';
import { activateProjectIfInactive } from '../src/shared/services/projectService.ts';

const inactiveProject: GcpProject = {
  id: '11111111-1111-1111-1111-111111111111',
  name: 'RTP Project',
  code: null,
  status: 0,
  companyId: null,
  companyName: null,
  etag: 'W/"100"',
};

test('recognizes only RTP verification submitted as FR', () => {
  assert.equal(isRtpFrVerification(1, 0), true);
  assert.equal(isRtpFrVerification(2, 0), false);
  assert.equal(isRtpFrVerification(1, 16), false);
  assert.equal(isRtpFrVerification(null, 0), false);
});

test('preflights the project before saving and activates it after request confirmation', async () => {
  const calls: string[] = [];

  await submitVerificationWithRtpProjectActivation(
    {
      matter: 1,
      targetStatus: 0,
      projectId: inactiveProject.id,
      verificationAlreadySaved: false,
    },
    {
      loadProject: async () => {
        calls.push('load-project');
        return inactiveProject;
      },
      verifyRequest: async () => {
        calls.push('verify-request');
      },
      confirmRequest: async () => {
        calls.push('confirm-request');
        return true;
      },
      activateProject: async (projectId, project) => {
        calls.push(`activate-project:${projectId}:${project.etag}`);
      },
    },
  );

  assert.deepEqual(calls, [
    'load-project',
    'verify-request',
    'confirm-request',
    `activate-project:${inactiveProject.id}:W/"100"`,
  ]);
});

test('rejects a missing RTP project before mutating the request', async () => {
  let requestMutated = false;

  await assert.rejects(
    submitVerificationWithRtpProjectActivation(
      {
        matter: 1,
        targetStatus: 0,
        projectId: null,
        verificationAlreadySaved: false,
      },
      {
        loadProject: async () => inactiveProject,
        verifyRequest: async () => {
          requestMutated = true;
        },
        confirmRequest: async () => true,
        activateProject: async () => undefined,
      },
    ),
    /no related project/i,
  );

  assert.equal(requestMutated, false);
});

test('rejects an unavailable RTP project before mutating the request', async () => {
  let requestMutated = false;

  await assert.rejects(
    submitVerificationWithRtpProjectActivation(
      {
        matter: 1,
        targetStatus: 0,
        projectId: inactiveProject.id,
        verificationAlreadySaved: false,
      },
      {
        loadProject: async () => null,
        verifyRequest: async () => {
          requestMutated = true;
        },
        confirmRequest: async () => true,
        activateProject: async () => undefined,
      },
    ),
    /related project could not be loaded/i,
  );

  assert.equal(requestMutated, false);
});

test('leaves non-RTP and non-FR verification on the ordinary request path', async () => {
  for (const input of [
    { matter: 2, targetStatus: 0 },
    { matter: 1, targetStatus: 16 },
  ]) {
    const calls: string[] = [];
    await submitVerificationWithRtpProjectActivation(
      {
        ...input,
        projectId: null,
        verificationAlreadySaved: false,
      },
      {
        loadProject: async () => {
          calls.push('load-project');
          return inactiveProject;
        },
        verifyRequest: async () => {
          calls.push('verify-request');
        },
        confirmRequest: async () => {
          calls.push('confirm-request');
          return true;
        },
        activateProject: async () => {
          calls.push('activate-project');
        },
      },
    );

    assert.deepEqual(calls, ['verify-request', 'confirm-request']);
  }
});

test('preserves ordinary verification when status confirmation times out', async () => {
  const calls: string[] = [];

  await submitVerificationWithRtpProjectActivation(
    {
      matter: 2,
      targetStatus: 0,
      projectId: null,
      verificationAlreadySaved: false,
    },
    {
      loadProject: async () => inactiveProject,
      verifyRequest: async () => {
        calls.push('verify-request');
      },
      confirmRequest: async () => {
        calls.push('confirm-request');
        return false;
      },
      activateProject: async () => {
        calls.push('activate-project');
      },
    },
  );

  assert.deepEqual(calls, ['verify-request', 'confirm-request']);
});

test('does not activate an RTP project until FR status is confirmed', async () => {
  let activated = false;

  await assert.rejects(
    submitVerificationWithRtpProjectActivation(
      {
        matter: 1,
        targetStatus: 0,
        projectId: inactiveProject.id,
        verificationAlreadySaved: false,
      },
      {
        loadProject: async () => inactiveProject,
        verifyRequest: async () => undefined,
        confirmRequest: async () => false,
        activateProject: async () => {
          activated = true;
        },
      },
    ),
    /status could not be confirmed/i,
  );

  assert.equal(activated, false);
});

test('project retry mode never rewrites request verification fields', async () => {
  const calls: string[] = [];

  await submitVerificationWithRtpProjectActivation(
    {
      matter: 1,
      targetStatus: 0,
      projectId: inactiveProject.id,
      verificationAlreadySaved: true,
    },
    {
      loadProject: async () => {
        calls.push('load-project');
        return inactiveProject;
      },
      verifyRequest: async () => {
        calls.push('verify-request');
      },
      confirmRequest: async () => {
        calls.push('confirm-request');
        return true;
      },
      activateProject: async () => {
        calls.push('activate-project');
      },
    },
  );

  assert.deepEqual(calls, ['load-project', 'activate-project']);
});

test('marks verification saved only after request status confirmation', async () => {
  const calls: string[] = [];

  await submitVerificationWithRtpProjectActivation(
    {
      matter: 1,
      targetStatus: 0,
      projectId: inactiveProject.id,
      verificationAlreadySaved: false,
    },
    {
      loadProject: async () => inactiveProject,
      verifyRequest: async () => {
        calls.push('verify-request');
      },
      confirmRequest: async () => {
        calls.push('confirm-request');
        return true;
      },
      onVerificationSaved: () => {
        calls.push('verification-saved');
      },
      activateProject: async () => {
        calls.push('activate-project');
      },
    },
  );

  assert.deepEqual(calls, [
    'verify-request',
    'confirm-request',
    'verification-saved',
    'activate-project',
  ]);
});

test('uses project-only retry copy after verification has been saved', () => {
  assert.deepEqual(getVerificationSubmissionPresentation(false), {
    submitLabel: 'Submit Verification',
    errorTitle: 'Couldn’t submit',
    errorPrefix: 'Failed to update request',
    progressTitle: 'Updating request',
    progressMessage: 'Saving your decision and confirming the status update…',
  });
  assert.deepEqual(getVerificationSubmissionPresentation(true), {
    submitLabel: 'Retry Project Activation',
    errorTitle: 'Verification saved, but project activation failed',
    errorPrefix: 'Failed to activate the related project',
    progressTitle: 'Activating project',
    progressMessage: 'Retrying the related project activation…',
  });
});

test('uses the confirmed project lifecycle values and maps the OData ETag', () => {
  assert.deepEqual(PROJECT_STATUS, {
    Inactive: 0,
    Active: 1,
    Completed: 2,
    Dead: 3,
  });

  assert.equal(
    mapGcpProject({
      '@odata.etag': 'W/"205"',
      gcp_projectsid: inactiveProject.id,
      gcp_projectstatus: 0,
    }).etag,
    'W/"205"',
  );
});

test('activates only an Inactive project using its observed ETag', async () => {
  const originalFetch = globalThis.fetch;
  invalidateAntiForgeryToken();
  const apiCalls: Array<{ url: string; method: string; ifMatch: string | null; body: string }> = [];

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url === '/_layout/tokenhtml') {
      return new Response('<input value="project-token" />', { status: 200 });
    }

    const headers = new Headers(init?.headers);
    apiCalls.push({
      url,
      method: init?.method ?? 'GET',
      ifMatch: headers.get('If-Match'),
      body: String(init?.body ?? ''),
    });
    return new Response(null, { status: 204 });
  }) as typeof fetch;

  try {
    const result = await activateProjectIfInactive(
      inactiveProject.id,
      inactiveProject,
    );

    assert.equal(result.outcome, 'activated');
    assert.deepEqual(apiCalls, [
      {
        url: `/_api/gcp_projectses(${inactiveProject.id})`,
        method: 'PATCH',
        ifMatch: 'W/"100"',
        body: '{"gcp_projectstatus":1}',
      },
    ]);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAntiForgeryToken();
  }
});

test('preserves every project status except Inactive without writing', async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('No Web API mutation was expected.');
  }) as typeof fetch;

  try {
    for (const status of [1, 2, 3, null, 9]) {
      const result = await activateProjectIfInactive(inactiveProject.id, {
        ...inactiveProject,
        status,
      });
      assert.equal(result.outcome, 'unchanged');
      assert.equal(result.project.status, status);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejects an Inactive project with no ETag without attempting a PATCH', async () => {
  const originalFetch = globalThis.fetch;
  let apiCalled = false;
  globalThis.fetch = (async () => {
    apiCalled = true;
    throw new Error('No Web API call was expected.');
  }) as typeof fetch;

  try {
    await assert.rejects(
      activateProjectIfInactive(inactiveProject.id, {
        ...inactiveProject,
        etag: null,
      }),
      /version could not be confirmed/i,
    );
    assert.equal(apiCalled, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('reloads after an ETag conflict and preserves a newly Completed project', async () => {
  const originalFetch = globalThis.fetch;
  invalidateAntiForgeryToken();
  let patchCalls = 0;

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url === '/_layout/tokenhtml') {
      return new Response('<input value="project-token" />', { status: 200 });
    }
    if (init?.method === 'PATCH') {
      patchCalls += 1;
      return new Response('', { status: 412 });
    }
    return Response.json({
      '@odata.etag': 'W/"101"',
      gcp_projectsid: inactiveProject.id,
      gcp_projectname: 'RTP Project',
      gcp_projectstatus: 2,
    });
  }) as typeof fetch;

  try {
    const result = await activateProjectIfInactive(
      inactiveProject.id,
      inactiveProject,
    );

    assert.equal(result.outcome, 'unchanged');
    assert.equal(result.project.status, 2);
    assert.equal(patchCalls, 1);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAntiForgeryToken();
  }
});

test('retries one ETag conflict with the newly loaded Inactive version', async () => {
  const originalFetch = globalThis.fetch;
  invalidateAntiForgeryToken();
  const patchEtags: Array<string | null> = [];

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url === '/_layout/tokenhtml') {
      return new Response('<input value="project-token" />', { status: 200 });
    }
    if (init?.method === 'PATCH') {
      patchEtags.push(new Headers(init.headers).get('If-Match'));
      return patchEtags.length === 1
        ? new Response('', { status: 412 })
        : new Response(null, { status: 204 });
    }
    return Response.json({
      '@odata.etag': 'W/"102"',
      gcp_projectsid: inactiveProject.id,
      gcp_projectname: 'RTP Project',
      gcp_projectstatus: 0,
    });
  }) as typeof fetch;

  try {
    const result = await activateProjectIfInactive(
      inactiveProject.id,
      inactiveProject,
    );

    assert.equal(result.outcome, 'activated');
    assert.deepEqual(patchEtags, ['W/"100"', 'W/"102"']);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAntiForgeryToken();
  }
});

test('propagates a second ETag conflict after exactly one retry', async () => {
  const originalFetch = globalThis.fetch;
  invalidateAntiForgeryToken();
  let patchCalls = 0;

  globalThis.fetch = (async (input, init) => {
    const url = String(input);
    if (url === '/_layout/tokenhtml') {
      return new Response('<input value="project-token" />', { status: 200 });
    }
    if (init?.method === 'PATCH') {
      patchCalls += 1;
      return new Response('', { status: 412 });
    }
    return Response.json({
      '@odata.etag': 'W/"103"',
      gcp_projectsid: inactiveProject.id,
      gcp_projectname: 'RTP Project',
      gcp_projectstatus: 0,
    });
  }) as typeof fetch;

  try {
    await assert.rejects(
      activateProjectIfInactive(inactiveProject.id, inactiveProject),
      (error: unknown) =>
        typeof error === 'object' &&
        error !== null &&
        (error as { status?: number }).status === 412,
    );
    assert.equal(patchCalls, 2);
  } finally {
    globalThis.fetch = originalFetch;
    invalidateAntiForgeryToken();
  }
});
