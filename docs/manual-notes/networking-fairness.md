# Speed networking: who sits out

*16 Sep 2026. Notes for the operator manual — how the rotation decides who is left over when the
numbers do not divide, and what an attendee is told about it.*

## The short version for the crew

When an odd number of people are in the networking queue, one person has to sit each round out.
That person is now **chosen**, not left over: it is whoever the queue owes the fewest sit-outs to,
and never the person who sat out the round before. Over a run of rounds everybody sits out the same
number of times, give or take one.

Nothing about this is visible as a new control. What the crew sees is that the "next up" count on
the networking card moves around the room instead of sticking to one or two names.

## Why it needed fixing

The rotation used to be a consequence of wait times: the queue was sorted longest-waiting first, so
whoever sat out kept the oldest timestamp and led the next round. That works — and it is exactly
what the crew's usual pattern breaks. **When the crew opens networking during a show, a roomful
presses Join in the same second.** Every queue row then carries the same `joinedAt`, there is
nothing to sort on, and the order falls back to an arbitrary tie-break that is also *stable*: the
same name is last every single time.

Measured on a simulated room where everyone joined at the identical instant, sit-outs per person
over 12 rounds, before the change:

| Waiting | Tier | Sit-outs per person | Spread | |
| --- | --- | --- | --- | --- |
| 3 | FIFO | 4, 4, 4 | 0 | fair |
| 5 | FIFO | 2, 2, 2, 3, 3 | 1 | fair |
| 7 | FIFO | 1, 1, 2, 2, 2, 2, 2 | 1 | fair |
| 9 | FIFO | 1, 1, 1, 1, 1, 1, 2, 2, 2 | 1 | fair |
| 12 | weighted random | nobody sits out — the numbers divide | 0 | fair |
| 13 | weighted random | 0, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1, 2, 2 | **2** | **unfair** |
| 51 | scored | 0 × 39, then 1 × 12 | 1 | fair on this fixture; see below |

The small-room tier was already fair, and for a reason rather than by luck: ending a match puts
both attendees back in the queue with a **fresh** join time, so the simultaneity only survives the
first round and the person who sat out really does have the oldest timestamp afterwards. That is
worth saying plainly, because it is the opposite of what was expected — the earlier report of this
defect assumed the small room was the broken case, and it was not.

The tiers that do **not** pair straight down the queue are where it broke. Above 12 waiting the
partner is drawn at random from the longest-waiting half; above 50 the pairs are scored on shared
topics and complementary goals and taken best-first. In both, the person left over was simply
whoever the draw or the score did not happen to take. The scored tier passed on a plain fixture
where nobody has an affinity advantage — but give the room one attendee who shares no topics with
anyone, and greedy-by-score put every other pair ahead of theirs and left them out however many
rounds they had already missed. That case is a test of its own now.

Two smaller faults were found in the same place and fixed with it:

- **The debt was cleared the moment somebody was matched**, which made it a record of the last
  round rather than of the event. A queue of three that joined together then handed the last two
  places back and forth: six sit-outs each over 12 rounds and none at all for the third person.
- **The matcher runs on every read**, so an attendee waiting alone while the rest of the room was
  mid-match was charged another sit-out *every time their phone polled* — the queue believed it
  owed them more the more often they looked.

## What it does now

- Every queue entry carries a running count of the rounds it has sat out. It is **carried through a
  match**, not cleared, and it is only incremented by a round that actually seated somebody.
- The queue order is: whoever sat out **last** round, then whoever is owed the most sit-outs, then
  longest waiting. Wait time is the last word instead of the first, because a room that joined
  together has no wait times to be fair with.
- With an odd number, the person held back is picked **before** any pairing runs — the least-owed,
  last in that order — so no tier can leave a different person out by accident. Anybody the round
  then could not seat is paired off with them afterwards, so holding a place back never costs a
  conversation that was really available.
- The debt is a **floor** at every tier. In the scored tier the pairs that seat whoever is owed most
  are taken first and the affinity score only chooses who they talk to; in the weighted-random tier
  seats are handed out in the same order and only the partner is drawn.
- Whoever a round left out is told **"you are next"**, and the next round seats them. That is now
  the same fact stated twice rather than two lists that could drift apart.

After the change, every size in the table above is spread 1 or 0.

## What it does not do

- It does not promise a seat to somebody who has **met everybody in the queue already**. They are
  told that instead, and offered "meet someone again"; telling them they are next would be a lie
  the next round could not keep.
- It does not carry a debt across leaving and rejoining. The count is dropped when an attendee
  leaves the queue, so a returning attendee starts level with the room.
- It does nothing about the fairness of *who you are matched with* — only of whether you are matched
  at all. Partner quality above 50 waiting is still the affinity score's job.

## Proof

`tests/unit/speedNetworkingFairness.test.ts` runs the simultaneous-join simulation against the real
matcher and the real store: N people join inside one tick, 12 rounds are played, and the assertions are on the whole distribution —
sit-out counts within one of each other, and nobody out twice running — at N = 3, 5, 7, 9, 12, 13
and 51, which covers all three tiers. `npm run validate:speed-networking-fairness` asserts the
wiring and runs that simulation; reading the source alone would pass a matcher that had every
correct-looking line and still rotated badly.
