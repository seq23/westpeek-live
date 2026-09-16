const fs = require('fs');
const checks = {
  'app/production-access/crew/page.tsx': ['htmlFor="crew-password"','htmlFor="crew-event-code"','htmlFor="crew-role"','secure production vault','never displays the password'],
  'app/production-access/operator/page.tsx': ['htmlFor="operator-password"','OPERATOR_LAUNCHPAD_PASSWORD','secure production vault','never displays the password'],
  'app/production-access/special-guest/page.tsx': ['htmlFor="special-event-code"','htmlFor="special-role-code"','secure production vault','never displays speaker, sponsor, VIP, or client passwords'],
  'app/join/page.tsx': ['htmlFor="join-event-code"'],
  'app/app/events/new/page.tsx': ['action={createEventAction}','name="when"','value="now"','value="later"','htmlFor="name"','required','RuntimeSchemaStop'],
  'lib/actions/eventWorkspaceActions.ts': ['"use server"','requireWorkspaceActor','createEventRecord','redirect(destination)'],
};
for (const [file, tokens] of Object.entries(checks)) {
  const s = fs.readFileSync(file, 'utf8');
  const missing = tokens.filter((token) => !s.includes(token));
  if (missing.length) throw new Error(`${file} missing front-door label/action tokens: ${missing.join(', ')}`);
}
// The create page must write a real row through the runtime-first repository, never a cookie/file draft.
if (fs.existsSync('services/events/eventDraftStore.ts')) throw new Error('eventDraftStore.ts was removed: /app/events/new must create a real runtime event, not a 30-minute cookie draft.');
const repository = fs.readFileSync('services/events/eventRepository.ts', 'utf8');
for (const token of ['getRuntimeStore().upsertRuntimeEvent', 'export async function findEventRecord', 'seedEventRecord(key)']) {
  if (!repository.includes(token)) throw new Error(`eventRepository.ts must stay runtime-first with seed fallback (missing ${token}).`);
}
for (const [file, token] of [['app/join/page.tsx', 'await resolveEventJoinCode('], ['services/events/eventStateResolver.ts', 'await ensureRuntimeEvent('], ['services/access/eventAccessResolver.ts', 'await ensureRuntimeEvent(']]) {
  if (!fs.readFileSync(file, 'utf8').includes(token)) throw new Error(`${file} must resolve runtime-created events before compiled seed JSON (missing ${token}).`);
}
console.log('validate_v7_frontdoor_labels: PASS');
