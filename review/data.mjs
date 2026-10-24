import { readFileSync } from 'node:fs';

const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
const titles = {
  'ed-science': 'Plants, water & pollination', 'ed-style': 'Editorial house style',
  'ed-hindi': 'पौधों का पाठ', 'hr-policy': 'Fictional staff handbook',
  'sales-catalogue': 'Fictional book catalogue', 'ed-injection': 'Untrusted source test',
  'ed-revision-current': 'Current edition note'
};

// Fixed source allow-list: never expose deployment files, secrets or arbitrary paths.
export const reviewFiles = new Map([
  ['foundation', 'specs/01-foundation.md'], ['identity', 'specs/02-access-control.md'],
  ['retrieval', 'specs/03-rag.md'], ['assistants', 'specs/04-department-assistants.md'],
  ['windows', 'docs/windows.md'], ['evidence', 'docs/phase-1-verification.md']
].map(([key, file]) => [key, read(file)]));

export function reviewData() {
  const corpus = JSON.parse(read('tests/fixtures/synthetic/library.json'));
  const documents = corpus.documents.filter(d => Object.hasOwn(titles, d.key) && d.status === 'active')
    .map(d => ({ key: d.key, title: titles[d.key], department: d.collection,
      sections: d.sections.map(s => ({ title: s.locator.label, text: s.text })) }));
  const profiles = [
    { id: 'editorial', label: 'Editorial', description: 'Review language. Stay close to the text.',
      tasks: ['British English copy-editing', 'Chapter-grounded questions', 'Worksheets for review'],
      example: 'Roots absorb water from the soil. Leaves use sunlight to make food for the plant.', source: 'Plants, water & pollination · plant',
      instructions: read('docs/assistants/editorial.md') },
    { id: 'hr', label: 'HR', description: 'Clear internal communication, grounded in policy.',
      tasks: ['Policy-based draft notices', 'Internal reminder drafts', 'Source-backed summaries'],
      example: 'Draft for review: Please submit planned-leave requests through the internal leave form. Your department manager will review the request.', source: 'Fictional staff handbook · leave',
      instructions: read('docs/assistants/hr.md') },
    { id: 'sales', label: 'Sales', description: 'Useful catalogue copy with supported details.',
      tasks: ['Catalogue descriptions', 'Sample-request draft replies', 'Product summaries'],
      example: 'Draft for review: Meadow Atlas is a spiral-bound geography workbook for Year 5.', source: 'Fictional book catalogue · atlas',
      instructions: read('docs/assistants/sales.md') }
  ];
  return {
    mode: 'read-only-local-review', acceptedPhases: 0,
    notice: 'Synthetic examples and design review only. Live AI, authentication, uploads and accounts workflows are not available.',
    documents, profiles,
    evaluationCases: {
      retrieval: JSON.parse(read('tests/fixtures/synthetic/phase-3-rag.json')).cases.length,
      assistants: JSON.parse(read('tests/fixtures/synthetic/phase-4-assistants.json')).cases.length,
      executed: 0
    },
    phases: [
      { number: 1, name: 'Local model foundation', status: 'Host acceptance pending', kind: 'pending', file: 'foundation', detail: 'Container configuration and local tooling prepared. Live offline chat, network isolation and recovery tests remain unrun.' },
      { number: 2, name: 'Authentication & permissions', status: 'Specification only', kind: 'draft', file: 'identity', detail: 'Identity, role and grant design prepared. No identity service, permission API or database implemented.' },
      { number: 3, name: 'Documents & retrieval', status: 'Specification only', kind: 'draft', file: 'retrieval', detail: 'Ingestion and retrieval design plus 30 synthetic cases prepared. No extraction, index or retrieval service implemented.' },
      { number: 4, name: 'Department assistants', status: 'Specification only', kind: 'draft', file: 'assistants', detail: 'Three instruction drafts and 40 evaluation cases prepared. No assistant deployed or model evaluation run.' },
      { number: 5, name: 'Accounts workflows', status: 'Not implemented', kind: 'closed', detail: 'Requires accepted permissions, deterministic decimal calculations, reconciliation tests and human financial review.' },
      { number: 6, name: 'Hardening & release', status: 'Not implemented', kind: 'closed', detail: 'Load tests, vulnerability review, retention, offline restore and administrator release sign-off remain outstanding.' }
    ]
  };
}
