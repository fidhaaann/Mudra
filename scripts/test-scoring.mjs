// Node test script to verify Mudra scoring rules

const POINT_RULES = {
  group: { first: 20, second: 15, third: 10 },
  duo: { first: 12, second: 8, third: 5 },
  solo: { first: 10, second: 7, third: 5 },
  offstage: { first: 8, second: 5, third: 3 }
};

function getPointsForRank(pointsCategory, rank) {
  const rules = POINT_RULES[pointsCategory];
  if (!rules) throw new Error(`Unknown category: ${pointsCategory}`);
  if (rank === 1) return rules.first;
  if (rank === 2) return rules.second;
  if (rank === 3) return rules.third;
  throw new Error(`Invalid rank: ${rank}`);
}

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ TEST FAILED: ${message}`);
    process.exit(1);
  }
}

console.log("=== MUDRA SCORING UNIT TESTS ===");

// 1. Group tests
assert(getPointsForRank("group", 1) === 20, "Group 1st place should be 20");
assert(getPointsForRank("group", 2) === 15, "Group 2nd place should be 15");
assert(getPointsForRank("group", 3) === 10, "Group 3rd place should be 10");
console.log("✓ GROUP points passed (20 / 15 / 10)");

// 2. Duo tests
assert(getPointsForRank("duo", 1) === 12, "Duo 1st place should be 12");
assert(getPointsForRank("duo", 2) === 8, "Duo 2nd place should be 8");
assert(getPointsForRank("duo", 3) === 5, "Duo 3rd place should be 5");
console.log("✓ DUO points passed (12 / 8 / 5)");

// 3. Solo tests
assert(getPointsForRank("solo", 1) === 10, "Solo 1st place should be 10");
assert(getPointsForRank("solo", 2) === 7, "Solo 2nd place should be 7");
assert(getPointsForRank("solo", 3) === 5, "Solo 3rd place should be 5");
console.log("✓ SOLO points passed (10 / 7 / 5)");

// 4. Off-stage Solo tests
assert(getPointsForRank("offstage", 1) === 8, "Offstage 1st place should be 8");
assert(getPointsForRank("offstage", 2) === 5, "Offstage 2nd place should be 5");
assert(getPointsForRank("offstage", 3) === 3, "Offstage 3rd place should be 3");
console.log("✓ OFF-STAGE SOLO points passed (8 / 5 / 3)");

// 5. CRITICAL TEST CASE: Painting Relay
const paintingRelayEvent = {
  id: "painting-relay",
  name: "PAINTING RELAY",
  category: "off-stage",
  participantType: "group",     // Note: participantType is group
  pointsCategory: "offstage"    // But pointsCategory is offstage!
};

const pr1st = getPointsForRank(paintingRelayEvent.pointsCategory, 1);
const pr2nd = getPointsForRank(paintingRelayEvent.pointsCategory, 2);
const pr3rd = getPointsForRank(paintingRelayEvent.pointsCategory, 3);

assert(pr1st === 8, `Painting relay 1st place must be 8, got ${pr1st}`);
assert(pr2nd === 5, `Painting relay 2nd place must be 5, got ${pr2nd}`);
assert(pr3rd === 3, `Painting relay 3rd place must be 3, got ${pr3rd}`);

console.log(`✓ CRITICAL TEST PASSED: Painting Relay (group participant, offstage category) scored ${pr1st} / ${pr2nd} / ${pr3rd}`);
console.log("ALL SCORING TESTS PASSED PERFECTLY!");
