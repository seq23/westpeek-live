const fs = require('fs');
function read(file){ if(!fs.existsSync(file)) throw new Error(`Missing ${file}`); return fs.readFileSync(file,'utf8'); }
function assert(c,m){ if(!c) throw new Error(m); }
assert(read('components/venue/LiveRoomChat.tsx').includes('roomKind') && read('components/venue/LiveRoomChat.tsx').includes('roomId'), 'LiveRoomChat must be room scoped.');
assert(read('components/venue/BreakoutRoomExperience.tsx').includes('roomKind: "breakout"'), 'Breakout room must render breakout-scoped chat.');
assert(read('components/venue/MainStageLiveChat.tsx').includes('roomKind: "main_stage"'), 'Main stage must render main-stage scoped chat.');
assert(read('services/runtime/runtimeStore.ts').includes('liveChatMessages'), 'Runtime store must include liveChatMessages.');
console.log('validate_live_chat_contract: PASS');
