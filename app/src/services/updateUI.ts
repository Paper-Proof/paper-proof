import { Editor } from '@tldraw/tldraw';

import buildProofTree from './buildProofTree';
import highlightNodes from './highlightNodes';
import zoomProofTree from './zoomProofTree';

import { ProofResponse } from '../types';

import converter from '../converter';

const uiConfig = {
  // Ideally it should be `hideNonContributingHyps` to hide all hyps which aren't contributing to goals in any way, but determining what hyps are used in what tactics isn't implemented properly yet, e.g. in linarith.
  hideNulls: true,
};

const areObjectsEqual = (a: object, b: object) => {
  return JSON.stringify(a) === JSON.stringify(b);
};

// This is resource-heavy, one of the reasons we want a production build that strips console.logs
const loggableProof = (proof: ProofResponse) => {
  if (!proof) {
    return null;
  } else if ("error" in proof) {
    return proof;
  } else {
    return converter(proof.proofTree);
  }
}

const updateUI = (editor: Editor, oldProof: ProofResponse, newProof: ProofResponse) => {
  editor.updateInstanceState({ isReadonly: false });

  console.table({ oldProof: loggableProof(oldProof), newProof: loggableProof(newProof) });

  const isNewProofEmpty = !newProof || "error" in newProof;
  const isOldProofEmpty = !oldProof || "error" in oldProof;

  if (isNewProofEmpty) {
    if (!newProof) {
      return;
    }
    if (newProof.error === 'File changed.' || newProof.error === 'stillTyping' || newProof.error === 'leanNotYetRunning') {
      return;
    } else if (newProof.error === 'zeroProofSteps') {
      editor.deleteShapes(editor.currentPageShapes);
      return;
    } else {
      console.warn("We are not explicitly handling some error?");
      console.warn(newProof);
      return;
    }
  }

  // So just - every time editor selection is changed, we do everything!
  const newProofTree = converter(newProof.proofTree);
  // The only expensive operation here is building the proof tree, so we try not to do it unless it's necessary
  if (isOldProofEmpty || !areObjectsEqual(oldProof.proofTree, newProof.proofTree)) {
    buildProofTree(editor, newProofTree, uiConfig);
  }
  highlightNodes(editor, newProofTree.equivalentIds, newProof.goal);
  zoomProofTree(editor);

  editor.updateInstanceState({ isReadonly: true });
}

export default updateUI;
