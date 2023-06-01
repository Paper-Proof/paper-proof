// import { createRequire } from 'module';
// const require = createRequire(import.meta.url);
// const util = require('util');
// 
// import { infoTreeExample_5 } from './infoTreeExample.js';

let windowId;

const newWindowId = () => {
  return windowId++;
}

const getHypChangesByUsername = (hypsBefore, hypsAfter) => {
  const hypsBeforeUsernames = hypsBefore.map((hyp) => hyp.username);
  const hypsAfterUsernames  = hypsAfter.map((hyp) => hyp.username);
  const hypsBeforeThatDisappeared = hypsBefore.filter((hyp) => !hypsAfterUsernames.includes(hyp.username));
  const hypsAfterThatAppeared     = hypsAfter.filter((hyp) => !hypsBeforeUsernames.includes(hyp.username));
  return [hypsBeforeThatDisappeared, hypsAfterThatAppeared];
}

// Handle a special case: the `rename/rename_i` tactic
// Notice how we're only calling this method in `1 goal => 1 goal` cases. It's theoretically possible that the hypothesis username would change with unchanged id on bifurcations, but then we'd have bigger problems (we'll want to create fake ids to know how to draw arrows!) - let's wait for this situation to arise.
const drawRenamedHypotheses = (currentWindow, hypsBefore, hypsAfter) => {
  const [hypsBeforeThatDisappeared, hypsAfterThatAppeared] = getHypChangesByUsername(hypsBefore, hypsAfter);

  // In renames, the hypothesis `id` stays the same, and its `username` changes.
  const isRename =
    hypsBeforeThatDisappeared.length === hypsAfterThatAppeared.length &&
    hypsBeforeThatDisappeared.every((h1) => hypsAfterThatAppeared.find((h2) => h1.id === h2.id)) &&
    hypsBeforeThatDisappeared.some((h1) => hypsAfterThatAppeared.find((h2) =>
      h1.id === h2.id && h1.username !== h2.username
    ));

  if (isRename) {
    hypsAfterThatAppeared.forEach((renamedHyp) => {
      // 1. Find the hypNode in our window that we want to rename
      currentWindow.hypNodes.forEach((hypLevel) => {
        hypLevel.forEach((existingHypNode) => {
          // 2. Update its name
          if (existingHypNode.id === renamedHyp.id) {
            existingHypNode.name = renamedHyp.username;
          }
        })
      });
    });
    return true;
  } else {
    return false;
  }
}

// Sometimes, the hypothesis id stays the same, but the username changes.
// The only case we where saw this happening are rewrites that mark the old hyp name with a tombstone, e.g. `coprime✝`m if they cannot clean it up (see https://github.com/leanprover/lean4/blob/5661b15e35285a4ed11e0d1d70a960117ea501a9/src/Lean/Meta/Tactic/Replace.lean#L89).
// In such cases, we want to modify the hyp's id with the username, so that our tactic's `{ fromId: ~, toId: ~ }` knows what it's referencing.
const handleTombstonedHypotheses = (hypsBefore, hypsAfterThatAppeared) => {
  hypsAfterThatAppeared.forEach((hypAfter) => {
    const hypBeforeWithSameId = hypsBefore.find((hypBefore) => hypBefore.id == hypAfter.id);
    if (hypBeforeWithSameId && hypAfter.username !== hypBeforeWithSameId.username) {
      hypAfter.id = `${hypAfter.id}-${hypAfter.username}`;
    }
  });
}

const drawNewHypotheses = (hypsBefore, hypsAfter) => {
  const prettyHypNodes = [];
  let prettyHypArrows = [];

  // 1. Determine which hypotheses disappeared and appeared username-wise
  const [hypsBeforeThatDisappeared, hypsAfterThatAppeared] = getHypChangesByUsername(hypsBefore, hypsAfter);
  handleTombstonedHypotheses(hypsBefore, hypsAfterThatAppeared);

  // 2. Draw them!
  // - if 0 hypotheses disappeared, and 0 hypotheses appeared, do nothing!
  if (hypsBeforeThatDisappeared.length === 0 && hypsAfterThatAppeared.length === 0) {
    // done :-)
  }
  // - if 0 hypotheses disappeared, and X hypotheses appeared, draw { null → id } arrows [many nulls!]
  else if (hypsBeforeThatDisappeared.length === 0 && hypsAfterThatAppeared.length > 0) {
    hypsAfterThatAppeared.forEach((hypAfter) => {
      prettyHypNodes.push({
        text: hypAfter.type,
        name: hypAfter.username,
        id  : hypAfter.id
      });

      prettyHypArrows.push({
        fromId: null,
        toId: hypAfter.id
      });
    });
  }
  // - if X hypotheses disappeared, and 0 hypotheses appeared, draw { id → null } arrows [many nulls!]
  else if (hypsBeforeThatDisappeared.length > 0 && hypsAfterThatAppeared.length === 0) {
    hypsBeforeThatDisappeared.forEach((hypBefore) => {
      prettyHypNodes.push({
        text: null,
        name: null,
        id  : `${hypBefore.id}-null`
      });

      prettyHypArrows.push({
        fromId: hypBefore.id,
        toId: `${hypBefore.id}-null`
      });
    });
  }
  // - if X hypotheses disappeared, and X hypotheses appeared, draw { everything → everything } arrows
  else if (hypsBeforeThatDisappeared.length > 0 && hypsAfterThatAppeared.length > 0) {
    hypsAfterThatAppeared.forEach((hypAfter) => {
      prettyHypNodes.push({
        text: hypAfter.type,
        name: hypAfter.username,
        id  : hypAfter.id
      });

      hypsBeforeThatDisappeared.forEach((hypBefore) => {
        prettyHypArrows.push({
          fromId: hypBefore.id,
          toId: hypAfter.id
        });
      });
    });
  }

  // 3. Then, independently, draw all the `.type` changes for hyps that stayed with the same username!
  hypsAfter.forEach((hypAfter) => {
    const hypBeforeWithSameUsername = hypsBefore.find((hypBefore) => hypBefore.username == hypAfter.username);
    if (hypBeforeWithSameUsername && hypBeforeWithSameUsername.type !== hypAfter.type) {
      prettyHypNodes.push({
        text: hypAfter.type,
        name: hypAfter.username,
        id  : hypAfter.id
      });

      prettyHypArrows.push({
        fromId: hypBeforeWithSameUsername.id,
        toId: hypAfter.id
      });
    }
  });

  return [prettyHypNodes.reverse(), prettyHypArrows];
}

// Any window is uniquely associated with a goal id.
// A particular goal id only ever belongs to some window. 
const getWindowByGoalId = (pretty, goalId) => {
  return pretty.windows.find((w) =>
    w.goalNodes.find((g) => g.id === goalId)
  )
}

const getRepresentativeGoalId = (pretty, id) => {
  const representativeId = Object.keys(pretty.equivalentGoalIds).find((representativeId) =>
    pretty.equivalentGoalIds[representativeId].find((inferiorId) => inferiorId === id)
  );
  return representativeId ? representativeId : id;
}

// We always wanna talk to the representative of our equivalent goals.
// Representative goal id is the one that's actually drawn. 
const addToEquivalentGoalIds = (pretty, beforeId, afterId) => {
  const existingGoal = pretty.equivalentGoalIds[getRepresentativeGoalId(pretty, beforeId)];
  if (existingGoal) {
    existingGoal.push(afterId)
  } else {
    pretty.equivalentGoalIds[beforeId] = [afterId];
  }
}

const handleTacticApp = (tactic, pretty, haveWindowId = null) => {
  // We assume `tactic.goalsBefore[0]` is always the goal the tactic worked on!
  // Is it fair to assume? So far seems good.
  const mainGoalBefore = tactic.goalsBefore[0];
  const representativeGoalId = getRepresentativeGoalId(pretty, mainGoalBefore.id);

  let currentWindow = getWindowByGoalId(pretty, representativeGoalId);

  if (!currentWindow) {
    // return; // 91 lines
    // currentWindow = pretty.windows[0]; // 191 lines
    // console.log(currentWindow);
    console.log("Couldn't find a window to place this tactic into.");
    console.log(util.inspect({ windows: pretty.windows, tactic, representativeGoalId }, { depth: null }));
  }

  const relevantGoalsAfter = tactic.goalsAfter
    .filter((goalAfter) =>
      !tactic.goalsBefore.find((goalBefore) => goalBefore.username === goalAfter.username) ||
      mainGoalBefore.username === goalAfter.username
    );

  // - we solved the goal!
  if (relevantGoalsAfter.length === 0) {
    const nextGoal = tactic.goalsAfter[0];

    pretty.tactics.push({
      text         : tactic.tacticString,
      dependsOnIds : tactic.tacticDependsOn,
      goalArrows   : [],
      hypArrows    : [],
      // success arrows are better not drawn (noisy!), we should just mark the tactic as 🎉.
      // .dependsOnIds will convey all the information we want to see.
      isSuccess    : nextGoal ? '🎉' : 'For all goals, 🎉!',
      successGoalId: representativeGoalId
    });
  }
  // - we updated the goal!
  else if (relevantGoalsAfter.length === 1) { 
    const updatedGoal = relevantGoalsAfter[0];

    // 1. Draw goal nodes and arrows
    let prettyGoalArrows = [];
    // In general, we would want to do this:
    // `if (mainGoalBefore.type !== updatedGoal.type) {`
    // However sometimes the goal id changes; and the type doesn't! Example: `let M := Nat.factorial N + 1; let p := Nat.minFac M`.
    // In such cases, we still want to put this goalNode into our window - to enable future tactics to find this window by goal id.
    // Also: future tactics might well be referencing that id! So we, of course, need to mark it as equivalent to other goal ids.
    if (mainGoalBefore.type === updatedGoal.type) {
      addToEquivalentGoalIds(pretty, mainGoalBefore.id, updatedGoal.id)
    } else {
      currentWindow.goalNodes.push({
        text: updatedGoal.type,
        id  : updatedGoal.id
      });
      prettyGoalArrows = [{
        fromId: representativeGoalId,
        toId: updatedGoal.id
      }];
    }

    // 2. Draw hypothesis nodes and arrows
    const hypsBefore = mainGoalBefore.hyps;
    const hypsAfter  = updatedGoal.hyps;
    const isRename = drawRenamedHypotheses(currentWindow, hypsBefore, hypsAfter);
    let [prettyHypNodes, prettyHypArrows] = isRename ?
      [[], []] :
      drawNewHypotheses(hypsBefore, hypsAfter);

    if (haveWindowId) {
      prettyHypNodes.forEach((hypNode) => {
        hypNode.haveWindowId = haveWindowId
      });
    }

    if (prettyHypNodes.length > 0) {
      currentWindow.hypNodes.push(prettyHypNodes);
    }

    pretty.tactics.push({
      text         : tactic.tacticString,
      dependsOnIds : tactic.tacticDependsOn,
      goalArrows   : prettyGoalArrows,
      hypArrows    : prettyHypArrows,
      isSuccess    : false
    });
  }
  // - we forked the goal!
  else if (relevantGoalsAfter.length > 1) {
    // 1. Draw goal nodes and arrows
    const prettyGoalArrows = relevantGoalsAfter.map((goal) => ({
      fromId: representativeGoalId,
      toId: goal.id
    }));

    const prettyHypArrows = [];
    // We are creating new child windows
    const childWindows = relevantGoalsAfter.map((goal) => {
      const hypsBefore = mainGoalBefore.hyps;
      const hypsAfter  = goal.hyps;
      const [prettyHypNodes, prettyHypArrowsForAChild] = drawNewHypotheses(hypsBefore, hypsAfter);
      prettyHypArrows.push(...prettyHypArrowsForAChild);

      return {
        id: newWindowId(),
        parentId: currentWindow.id,
        goalNodes: [
          {
            text: goal.type,
            id: goal.id
          }
        ],
        hypNodes: prettyHypNodes.length > 0 ? [prettyHypNodes] : []
      }
    });
    pretty.windows.push(...childWindows);

    pretty.tactics.push({
      text         : tactic.tacticString,
      dependsOnIds : tactic.tacticDependsOn,
      goalArrows   : prettyGoalArrows,
      hypArrows    : prettyHypArrows,
      isSuccess    : false
    });
  }
}

const drawInitialGoal = (initialMainGoal, pretty) => {
  const hypNodes = initialMainGoal.hyps.map((hyp) => ({
    text: hyp.type,
    name: hyp.username,
    id  : hyp.id
  }));
  const initialWindow = {
    id: newWindowId(),
    parentId: null,
    goalNodes: [
      {
        text: initialMainGoal.type,
        id  : initialMainGoal.id
      }
    ],
    hypNodes: hypNodes.length > 0 ? [hypNodes.reverse()] : []
  };
  pretty.windows.push(initialWindow);
}

const getInitialGoal = (subSteps) => {
  const firstStep = subSteps[0];
  if (firstStep.tacticApp) {
    return firstStep.tacticApp.t.goalsBefore[0];
  } else if (firstStep.haveDecl) {
    return firstStep.haveDecl.t.goalsBefore[0];
  }
}

const recursive = (subSteps, pretty) => {
  subSteps.forEach((subStep) => {
    if (subStep.tacticApp) {
      handleTacticApp(subStep.tacticApp.t, pretty);
    } else if (subStep.haveDecl) {
      const haveWindowId = newWindowId();

      handleTacticApp(subStep.haveDecl.t, pretty, haveWindowId);

      const intitialGoal = getInitialGoal(subStep.haveDecl.subSteps);

      const initialWindow = {
        id: haveWindowId,
        // Parent window is such that has our goalId as a hypothesis.
        // `have`'s fvarid won't equal `have's` mvarid however - so the only way to match them would be by the username. many `have`s may have the same username though, so let's just store out parentId.
        parentId: "haveWindow",
        goalNodes: [
          {
            text: intitialGoal.type,
            id  : intitialGoal.id
          }
        ],
        // `have`s don't introduce any new hypotheses
        hypNodes: []
      };
      pretty.windows.push(initialWindow);

      recursive(subStep.haveDecl.subSteps, pretty);
    }
  })
}

export const toEdges = (infoTreeVast) => {
  windowId = 1;

  const pretty = {
    equivalentGoalIds: {},
    windows: [],
    tactics: []
  }

  // First of all, draw the INITIAL hypotheses and goal.
  const intitialGoal = getInitialGoal(infoTreeVast);
  drawInitialGoal(intitialGoal, pretty);

  // Then, draw all the other tactics and hypotheses and goals.
  recursive(infoTreeVast, pretty);

  return pretty;
}

// const edges = toEdges(infoTreeExample_5)
// console.log(util.inspect(edges, { depth: null }));
