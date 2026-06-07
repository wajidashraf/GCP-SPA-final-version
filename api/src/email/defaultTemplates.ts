// Built-in fallback templates used when an admin has not created a custom template
// for a given (eventKey × recipientRole) pair. Admin templates always take precedence —
// these only fire for roles that have no active row in gcp_emailtemplate.
//
// Keep subjects/blocks in sync with the placeholder catalog in
// src/data/emailTemplateEvents.ts (frontend). All tokens are substituted by
// renderTemplate.ts at send time; HTML-escaped after substitution.

import type { EmailBlock } from './renderTemplate.js';

export interface DefaultTemplate {
  eventKey: string;
  recipientRole: string;
  subject: string;
  blocks: EmailBlock[];
}

export const DEFAULT_TEMPLATES: readonly DefaultTemplate[] = [
  // ──────────────────────────────────────────────────────────────────────────
  // request_submitted
  // ──────────────────────────────────────────────────────────────────────────
  {
    eventKey: 'request_submitted',
    recipientRole: 'requester',
    subject: 'Request Submitted: {{requestName}}',
    blocks: [
      { type: 'heading', text: 'Request Submitted' },
      {
        type: 'paragraph',
        text: 'Your request has been submitted successfully and is now pending verification.',
      },
      {
        type: 'fields',
        rows: [
          { label: 'Reference', value: '{{requestNumber}}' },
          { label: 'Request', value: '{{requestName}}' },
          { label: 'Category', value: '{{requestCategory}}' },
          { label: 'Submitted', value: '{{submissionDate}}' },
          { label: 'Status', value: '{{requestStatus}}' },
        ],
      },
      {
        type: 'paragraph',
        text: 'You will receive another notification once the verification step is complete.',
      },
      { type: 'divider' },
      { type: 'button', label: 'View Request', href: '{{viewLink}}' },
    ],
  },
  {
    eventKey: 'request_submitted',
    recipientRole: 'verifier',
    subject: 'New Request Awaiting Verification: {{requestName}}',
    blocks: [
      { type: 'heading', text: 'New Request for Verification' },
      {
        type: 'paragraph',
        text: 'A new request has been submitted and is awaiting your verification.',
      },
      {
        type: 'fields',
        rows: [
          { label: 'Reference', value: '{{requestNumber}}' },
          { label: 'Request', value: '{{requestName}}' },
          { label: 'Category', value: '{{requestCategory}}' },
          { label: 'Submitted by', value: '{{requestorName}}' },
          { label: 'Submitted on', value: '{{submissionDate}}' },
        ],
      },
      { type: 'divider' },
      { type: 'button', label: 'Review & Verify', href: '{{viewLink}}' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // request_verified
  // ──────────────────────────────────────────────────────────────────────────
  {
    eventKey: 'request_verified',
    recipientRole: 'requester',
    subject: 'Your Request Has Been Verified: {{requestName}}',
    blocks: [
      { type: 'heading', text: 'Request Verified' },
      {
        type: 'paragraph',
        text: 'Your request has been reviewed by the verifier and is now moving to the review stage.',
      },
      {
        type: 'fields',
        rows: [
          { label: 'Reference', value: '{{requestNumber}}' },
          { label: 'Request', value: '{{requestName}}' },
          { label: 'Status', value: '{{requestStatus}}' },
          { label: 'Verifier', value: '{{verifierName}}' },
          { label: 'Verified on', value: '{{verifyDate}}' },
          { label: 'Comment', value: '{{verifierComment}}' },
        ],
      },
      { type: 'divider' },
      { type: 'button', label: 'View Request', href: '{{viewLink}}' },
    ],
  },
  {
    eventKey: 'request_verified',
    recipientRole: 'reviewer',
    subject: 'Request Ready for Your Review: {{requestName}}',
    blocks: [
      { type: 'heading', text: 'Request Assigned for Review' },
      {
        type: 'paragraph',
        text: 'A request has been verified and is now assigned to you for review. Please log in to the GCP Portal to complete the review.',
      },
      {
        type: 'fields',
        rows: [
          { label: 'Reference', value: '{{requestNumber}}' },
          { label: 'Request', value: '{{requestName}}' },
          { label: 'Category', value: '{{requestCategory}}' },
          { label: 'Submitted by', value: '{{requestorName}}' },
          { label: 'Verifier', value: '{{verifierName}}' },
          { label: 'Verifier comment', value: '{{verifierComment}}' },
        ],
      },
      { type: 'divider' },
      { type: 'button', label: 'Review Request', href: '{{viewLink}}' },
    ],
  },

  // ──────────────────────────────────────────────────────────────────────────
  // request_reviewed
  // ──────────────────────────────────────────────────────────────────────────
  {
    eventKey: 'request_reviewed',
    recipientRole: 'requester',
    subject: 'Decision on Your Request: {{requestName}}',
    blocks: [
      { type: 'heading', text: 'Request Review Completed' },
      {
        type: 'paragraph',
        text: 'Your request has been reviewed and a decision has been made. Please find the details below.',
      },
      {
        type: 'fields',
        rows: [
          { label: 'Reference', value: '{{requestNumber}}' },
          { label: 'Request', value: '{{requestName}}' },
          { label: 'Status', value: '{{requestStatus}}' },
          { label: 'Reviewer', value: '{{reviewerName}}' },
          { label: 'Decision', value: '{{decisionCode}}' },
          { label: 'Outcome', value: '{{outcome}}' },
          { label: 'Reviewed on', value: '{{reviewDate}}' },
        ],
      },
      { type: 'divider' },
      { type: 'button', label: 'View Request', href: '{{viewLink}}' },
    ],
  },
  {
    eventKey: 'request_reviewed',
    recipientRole: 'working_gcpc',
    subject: 'Review Completed — Action May Be Required: {{requestName}}',
    blocks: [
      { type: 'heading', text: 'Request Review Completed' },
      {
        type: 'paragraph',
        text: 'A request review has been completed. Please review the outcome and take any necessary follow-up action.',
      },
      {
        type: 'fields',
        rows: [
          { label: 'Reference', value: '{{requestNumber}}' },
          { label: 'Request', value: '{{requestName}}' },
          { label: 'Category', value: '{{requestCategory}}' },
          { label: 'Submitted by', value: '{{requestorName}}' },
          { label: 'Decision', value: '{{decisionCode}}' },
          { label: 'Outcome', value: '{{outcome}}' },
          { label: 'Reviewed on', value: '{{reviewDate}}' },
        ],
      },
      { type: 'divider' },
      { type: 'button', label: 'View Request', href: '{{viewLink}}' },
    ],
  },
];

/** Return default templates for a given event key. */
export const getDefaultTemplatesForEvent = (eventKey: string): DefaultTemplate[] =>
  DEFAULT_TEMPLATES.filter((t) => t.eventKey === eventKey);
