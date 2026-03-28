import { useCallback } from 'react';
import * as d3 from 'd3';
import { GraphNode, LayoutType, ForceDirectedGraphHandle } from './types';
import { pinNode, unpinAllNodes } from './useGraphInteractions';
import {
  DEFAULT_NODE_SIZE,
  FIT_VIEW_PADDING,
  TRANSITION_DURATION_MS,
} from '../constants';

interface UseImperativeHandleProps {
  nodes: GraphNode[];
  pinnedNodes: Set<string>;
  setPinnedNodes: React.Dispatch<React.SetStateAction<Set<string>>>;
  restart: () => void;
  width: number;
  height: number;
  layout: LayoutType;
  handleLayoutChange: (layout: LayoutType) => void;
  setForcesEnabled: (enabled: boolean) => void;
  svgRef: React.RefObject<SVGSVGElement | null>;
  gRef: React.RefObject<SVGGElement | null>;
  setTransform: (transform: { k: number; x: number; y: number }) => void;
  internalDragEnabledRef: React.MutableRefObject<boolean>;
}

/**
 * Creates the imperative handle methods for the ForceDirectedGraph component.
 */
export function useImperativeHandleMethods({
  nodes,
  pinnedNodes,
  setPinnedNodes,
  restart,
  width,
  height,
  layout,
  handleLayoutChange,
  svgRef,
  gRef,
  setTransform,
  internalDragEnabledRef,
}: UseImperativeHandleProps): ForceDirectedGraphHandle {
  const pinAll = useCallback(() => {
    const newPinned = new Set<string>();
    nodes.forEach((node) => {
      pinNode(node);
      newPinned.add(node.id);
    });
    setPinnedNodes(newPinned);
    restart();
  }, [nodes, setPinnedNodes, restart]);

  const unpinAll = useCallback(() => {
    unpinAllNodes(nodes);
    setPinnedNodes(new Set());
    restart();
  }, [nodes, setPinnedNodes, restart]);

  const resetLayout = useCallback(() => {
    unpinAllNodes(nodes);
    setPinnedNodes(new Set());
    restart();
  }, [nodes, setPinnedNodes, restart]);

  const fitView = useCallback(() => {
    if (!svgRef.current || !nodes.length) return;
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    nodes.forEach((node) => {
      if (node.x !== undefined && node.y !== undefined) {
        const size = node.size || DEFAULT_NODE_SIZE;
        minX = Math.min(minX, node.x - size);
        maxX = Math.max(maxX, node.x + size);
        minY = Math.min(minY, node.y - size);
        maxY = Math.max(maxY, node.y + size);
      }
    });
    if (!isFinite(minX)) return;
    const scale = Math.min(
      (width - FIT_VIEW_PADDING * 2) / (maxX - minX),
      (height - FIT_VIEW_PADDING * 2) / (maxY - minY),
      10
    );
    const x = width / 2 - ((minX + maxX) / 2) * scale;
    const y = height / 2 - ((minY + maxY) / 2) * scale;
    if (gRef.current && svgRef.current) {
      const svg = d3.select(svgRef.current);
      const newTransform = d3.zoomIdentity.translate(x, y).scale(scale);
      svg
        .transition()
        .duration(TRANSITION_DURATION_MS)
        .call(d3.zoom().transform as any, newTransform);
      setTransform(newTransform);
    }
  }, [nodes, width, height, svgRef, gRef, setTransform]);

  const getPinnedNodes = useCallback(
    () => Array.from(pinnedNodes),
    [pinnedNodes]
  );

  const setDragMode = useCallback(
    (enabled: boolean) => {
      internalDragEnabledRef.current = enabled;
    },
    [internalDragEnabledRef]
  );

  const setLayoutMethod = useCallback(
    (newLayout: LayoutType) => {
      handleLayoutChange(newLayout);
    },
    [handleLayoutChange]
  );

  const getLayout = useCallback(() => layout, [layout]);

  return {
    pinAll,
    unpinAll,
    resetLayout,
    fitView,
    getPinnedNodes,
    setDragMode,
    setLayout: setLayoutMethod,
    getLayout,
  };
}
