import { useCallback, useEffect } from 'react';
import * as d3 from 'd3';
import { GraphNode } from './types';

/** Pins a node to its current position (sets fx/fy to current x/y) */
export function pinNode(node: GraphNode): void {
  node.fx = node.x;
  node.fy = node.y;
}

/** Unpins a node (sets fx/fy to null) */
export function unpinNode(node: GraphNode): void {
  node.fx = null;
  node.fy = null;
}

/** Unpins all nodes - helper for bulk unpin operations */
export function unpinAllNodes(nodes: GraphNode[]): void {
  nodes.forEach(unpinNode);
}

/**
 * Hook for managing D3 zoom behavior on an SVG element.
 */
export function useGraphZoom(
  svgRef: React.RefObject<SVGSVGElement | null>,
  gRef: React.RefObject<SVGGElement | null>,
  enableZoom: boolean,
  setTransform: (transform: { k: number; x: number; y: number }) => void,
  transformRef: React.MutableRefObject<{ k: number; x: number; y: number }>
) {
  useEffect(() => {
    if (!enableZoom || !svgRef.current || !gRef.current) return;

    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);

    const zoom = (d3 as typeof d3)
      .zoom()
      .scaleExtent([0.1, 10])
      .on('zoom', (event: any) => {
        g.attr('transform', event.transform);
        transformRef.current = event.transform;
        setTransform(event.transform);
      });

    svg.call(zoom as unknown as any);

    return () => {
      svg.on('.zoom', null);
    };
  }, [enableZoom, svgRef, gRef, setTransform, transformRef]);
}

/**
 * Hook for managing window-level drag events for smooth node dragging.
 */
export function useWindowDrag(
  enableDrag: boolean,
  svgRef: React.RefObject<SVGSVGElement | null>,
  transformRef: React.MutableRefObject<{ k: number; x: number; y: number }>,
  dragActiveRef: React.MutableRefObject<boolean>,
  dragNodeRef: React.MutableRefObject<GraphNode | null>,
  onDragEnd: () => void
) {
  useEffect(() => {
    if (!enableDrag) return;

    const handleWindowMove = (event: MouseEvent) => {
      if (!dragActiveRef.current || !dragNodeRef.current) return;
      const svg = svgRef.current;
      if (!svg) return;
      const rect = svg.getBoundingClientRect();
      const t: any = transformRef.current;
      const x = (event.clientX - rect.left - t.x) / t.k;
      const y = (event.clientY - rect.top - t.y) / t.k;
      dragNodeRef.current.fx = x;
      dragNodeRef.current.fy = y;
    };

    const handleWindowUp = () => {
      if (!dragActiveRef.current) return;
      onDragEnd();
      dragNodeRef.current = null;
      dragActiveRef.current = false;
    };

    const handleWindowLeave = (event: MouseEvent) => {
      if (event.relatedTarget === null) handleWindowUp();
    };

    window.addEventListener('mousemove', handleWindowMove);
    window.addEventListener('mouseup', handleWindowUp);
    window.addEventListener('mouseout', handleWindowLeave);
    window.addEventListener('blur', handleWindowUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('mouseup', handleWindowUp);
      window.removeEventListener('mouseout', handleWindowLeave);
      window.removeEventListener('blur', handleWindowUp);
    };
  }, [enableDrag, svgRef, transformRef, dragActiveRef, dragNodeRef, onDragEnd]);
}

/**
 * Hook for managing node interactions (drag, double-click pinning).
 */
export function useNodeInteractions(
  enableDrag: boolean,
  _nodes: GraphNode[],
  _pinnedNodes: Set<string>,
  setPinnedNodes: React.Dispatch<React.SetStateAction<Set<string>>>,
  restart: () => void,
  stop: () => void
) {
  const handleDragStart = useCallback(
    (event: React.MouseEvent, node: GraphNode) => {
      if (!enableDrag) return;
      event.preventDefault();
      event.stopPropagation();
      pinNode(node);
      setPinnedNodes((prev) => new Set([...prev, node.id]));
      stop();
    },
    [enableDrag, stop, setPinnedNodes]
  );

  const handleNodeDoubleClick = useCallback(
    (event: React.MouseEvent, node: GraphNode) => {
      event.stopPropagation();
      if (!enableDrag) return;
      if (node.fx === null || node.fx === undefined) {
        pinNode(node);
        setPinnedNodes((prev) => new Set([...prev, node.id]));
      } else {
        unpinNode(node);
        setPinnedNodes((prev) => {
          const next = new Set(prev);
          next.delete(node.id);
          return next;
        });
      }
      restart();
    },
    [enableDrag, restart, setPinnedNodes]
  );

  return { handleDragStart, handleNodeDoubleClick };
}
