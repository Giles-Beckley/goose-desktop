/**
 * Editor state with undo/redo.
 *
 * Drags and resizes are "gestures": gesture/start remembers the layout,
 * transient updates then change it on every pointer move without touching
 * history, and gesture/end records a single undo step. Everything else
 * (property edits, adding, deleting) records its own step.
 */

import type { ElementType, Layout, LayoutElement, Point } from '../model/types';
import { createElement, duplicateElement, rotateElement } from './elements';

const HISTORY_LIMIT = 100;

export interface EditorState {
  layout: Layout;
  selectedId: string | null;
  past: Layout[];
  future: Layout[];
  gestureBase: Layout | null;
}

export type EditorAction =
  | { type: 'load'; layout: Layout }
  /** The server's normalised copy after a save; keeps undo history. */
  | { type: 'saved'; layout: Layout }
  | { type: 'select'; id: string | null }
  | { type: 'add'; elementType: ElementType; at: Point }
  | { type: 'update'; id: string; patch: Partial<LayoutElement>; transient?: boolean }
  | { type: 'remove'; id: string }
  | { type: 'duplicate'; id: string }
  | { type: 'rotate'; id: string }
  | { type: 'warehouse'; patch: Partial<Pick<Layout, 'width_cm' | 'depth_cm' | 'grid_cm'>> }
  | { type: 'gesture/start' }
  | { type: 'gesture/end' }
  | { type: 'undo' }
  | { type: 'redo' };

export function initialState(layout: Layout): EditorState {
  return { layout, selectedId: null, past: [], future: [], gestureBase: null };
}

/** Record the current layout as an undo step and apply the next one. */
function commit(state: EditorState, layout: Layout, selectedId = state.selectedId): EditorState {
  return {
    ...state,
    layout,
    selectedId,
    past: [...state.past, state.layout].slice(-HISTORY_LIMIT),
    future: [],
  };
}

function replaceElement(layout: Layout, id: string, next: (element: LayoutElement) => LayoutElement): Layout {
  return { ...layout, elements: layout.elements.map((element) => (element.id === id ? next(element) : element)) };
}

function find(layout: Layout, id: string): LayoutElement | undefined {
  return layout.elements.find((element) => element.id === id);
}

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'load':
      return initialState(action.layout);

    case 'saved':
      return {
        ...state,
        layout: action.layout,
        selectedId: state.selectedId && find(action.layout, state.selectedId) ? state.selectedId : null,
      };

    case 'select':
      return state.selectedId === action.id ? state : { ...state, selectedId: action.id };

    case 'add': {
      const element = createElement(state.layout, action.elementType, action.at);
      return commit(state, { ...state.layout, elements: [...state.layout.elements, element] }, element.id);
    }

    case 'update': {
      if (!find(state.layout, action.id)) return state;
      const layout = replaceElement(state.layout, action.id, (element) => ({ ...element, ...action.patch }));
      return action.transient ? { ...state, layout } : commit(state, layout);
    }

    case 'remove': {
      if (!find(state.layout, action.id)) return state;
      const layout = { ...state.layout, elements: state.layout.elements.filter((element) => element.id !== action.id) };
      return commit(state, layout, state.selectedId === action.id ? null : state.selectedId);
    }

    case 'duplicate': {
      const source = find(state.layout, action.id);
      if (!source) return state;
      const copy = duplicateElement(state.layout, source);
      return commit(state, { ...state.layout, elements: [...state.layout.elements, copy] }, copy.id);
    }

    case 'rotate': {
      if (!find(state.layout, action.id)) return state;
      return commit(state, replaceElement(state.layout, action.id, rotateElement));
    }

    case 'warehouse':
      return commit(state, { ...state.layout, ...action.patch });

    case 'gesture/start':
      return { ...state, gestureBase: state.layout };

    case 'gesture/end': {
      const base = state.gestureBase;
      if (!base) return state;
      if (base === state.layout) return { ...state, gestureBase: null };
      return {
        ...state,
        gestureBase: null,
        past: [...state.past, base].slice(-HISTORY_LIMIT),
        future: [],
      };
    }

    case 'undo': {
      const previous = state.past[state.past.length - 1];
      if (!previous) return state;
      return {
        ...state,
        layout: previous,
        past: state.past.slice(0, -1),
        future: [state.layout, ...state.future],
        selectedId: state.selectedId && find(previous, state.selectedId) ? state.selectedId : null,
      };
    }

    case 'redo': {
      const next = state.future[0];
      if (!next) return state;
      return {
        ...state,
        layout: next,
        past: [...state.past, state.layout],
        future: state.future.slice(1),
        selectedId: state.selectedId && find(next, state.selectedId) ? state.selectedId : null,
      };
    }

    default:
      return state;
  }
}
