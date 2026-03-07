import { useEffect, useState, useMemo } from 'react';
import { GraphData, FileNode, SeverityLevel, EdgeType } from './types';
import { themeConfig } from './constants';
import { transformReportToGraph, loadReportData } from './utils';
import { useDimensions } from './hooks/useDimensions';
import { useTheme } from './hooks/useTheme';
import {
  LoadingSpinner,
  ErrorDisplay,
  Navbar,
  LegendPanel,
  NodeDetails,
  GraphCanvas,
} from './components';

// All available severity levels
const ALL_SEVERITIES: SeverityLevel[] = ['critical', 'major', 'minor', 'info'];

// All available edge types (excluding 'default' and 'reference' as they're filtered out in UI)
const ALL_EDGE_TYPES: EdgeType[] = ['similarity', 'dependency', 'related'];

function App() {
  const [data, setData] = useState<GraphData | null>(null);
  const [selectedNode, setSelectedNode] = useState<FileNode | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [truncatedWarning, setTruncatedWarning] = useState<{
    nodes: boolean;
    edges: boolean;
  } | null>(null);

  // Filter state - start with all visible
  const [visibleSeverities, setVisibleSeverities] = useState<
    Set<SeverityLevel>
  >(new Set(ALL_SEVERITIES));
  const [visibleEdgeTypes, setVisibleEdgeTypes] = useState<Set<EdgeType>>(
    new Set(ALL_EDGE_TYPES)
  );

  const { containerRef, dimensions } = useDimensions();
  const { theme, setTheme, effectiveTheme } = useTheme();

  const colors = themeConfig[effectiveTheme];

  // Load report data
  useEffect(() => {
    const loadData = async () => {
      try {
        const reportData = await loadReportData();

        if (!reportData) {
          setError(
            'No scan data found. Run "pnpm aiready scan ." then copy to public/report-data.json'
          );
          setLoading(false);
          return;
        }

        // Extract optional visualizer config from report (injected by CLI)
        const visualizerConfig = (reportData as any).visualizerConfig;
        const graphData = transformReportToGraph(reportData, visualizerConfig);
        setData(graphData);

        // Show warning if graph was truncated
        if (graphData.truncated?.nodes || graphData.truncated?.edges) {
          setTruncatedWarning({
            nodes: graphData.truncated.nodes,
            edges: graphData.truncated.edges,
          });
        }
      } catch (err: any) {
        console.error('Failed to load or transform report data:', err);
        setError(`Failed to load visualization: ${err.message || 'Unknown error'}`);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // Toggle severity visibility
  const handleToggleSeverity = (severity: SeverityLevel) => {
    setVisibleSeverities((prev) => {
      const next = new Set(prev);
      if (next.has(severity)) {
        next.delete(severity);
      } else {
        next.add(severity);
      }
      return next;
    });
  };

  // Toggle edge type visibility
  const handleToggleEdgeType = (edgeType: EdgeType) => {
    setVisibleEdgeTypes((prev) => {
      const next = new Set(prev);
      if (next.has(edgeType)) {
        next.delete(edgeType);
      } else {
        next.add(edgeType);
      }
      return next;
    });
  };

  // Filter data based on visible severities and edge types
  // Also hides edges connected to hidden nodes
  const filteredData = useMemo(() => {
    if (!data) return null;

    // Get set of visible node IDs
    const visibleNodeIds = new Set(
      data.nodes
        .filter((node) => {
          const severity = (node.severity || 'default') as SeverityLevel;
          return visibleSeverities.has(severity);
        })
        .map((node) => node.id)
    );

    // Filter nodes: keep if severity is visible
    const filteredNodes = data.nodes.filter((node) => {
      const severity = (node.severity || 'default') as SeverityLevel;
      return visibleSeverities.has(severity);
    });

    // Filter edges: keep if:
    // 1. Edge type is visible AND
    // 2. Both source and target nodes are visible
    const filteredEdges = data.edges.filter((edge) => {
      // Check edge type visibility
      const edgeType = (edge.type || 'default') as EdgeType;
      if (!visibleEdgeTypes.has(edgeType)) {
        return false;
      }
      // Check that both connected nodes are visible
      const sourceId =
        typeof edge.source === 'string' ? edge.source : (edge.source as any).id;
      const targetId =
        typeof edge.target === 'string' ? edge.target : (edge.target as any).id;
      return visibleNodeIds.has(sourceId) && visibleNodeIds.has(targetId);
    });

    return {
      nodes: filteredNodes,
      edges: filteredEdges,
    };
  }, [data, visibleSeverities, visibleEdgeTypes]);

  // Handle loading state
  if (loading) {
    return <LoadingSpinner colors={colors} />;
  }

  // Handle error state
  if (error) {
    return <ErrorDisplay colors={colors} error={error} />;
  }

  return (
    <div
      className="flex flex-col h-screen font-sans"
      style={{ backgroundColor: colors.bg, color: colors.text }}
    >
      <Navbar
        colors={colors}
        theme={theme}
        setTheme={setTheme}
        data={filteredData}
        metadata={data?.metadata}
      />

      {/* Truncation warning banner */}
      {truncatedWarning &&
        (truncatedWarning.nodes || truncatedWarning.edges) && (
          <div
            className="px-4 py-3 bg-yellow-50 border-b flex items-center justify-between"
            style={{ borderColor: colors.panelBorder }}
          >
            <div className="flex-1">
              <p className="text-sm text-yellow-800 font-medium">
                ⚠️ Graph visualization truncated at display limits.
                {truncatedWarning.nodes && ' Too many nodes.'}
                {truncatedWarning.edges && ' Too many edges.'}
              </p>
              <p className="text-xs text-yellow-700 mt-1">
                To show more data, increase graph limits in aiready.json:
                <code
                  className="bg-yellow-100 px-1 rounded"
                  style={{ marginLeft: '4px' }}
                >
                  {
                    '"visualizer": { "graph": { "maxNodes": 2000, "maxEdges": 5000 } }'
                  }
                </code>
              </p>
            </div>
            <button
              onClick={() => setTruncatedWarning(null)}
              className="text-yellow-600 hover:text-yellow-800 ml-4 flex-shrink-0"
            >
              ✕
            </button>
          </div>
        )}

      <div className="flex flex-1 overflow-hidden">
        <div ref={containerRef} className="flex-1 relative">
          {filteredData && (
            <GraphCanvas
              data={filteredData}
              dimensions={dimensions}
              colors={colors}
              effectiveTheme={effectiveTheme}
              onNodeClick={setSelectedNode}
            />
          )}
        </div>

        {/* Right panel: Legend OR NodeDetails */}
        <div
          className="w-80 border-l flex flex-col h-full"
          style={{
            backgroundColor: colors.panel,
            borderColor: colors.panelBorder,
          }}
        >
          {selectedNode ? (
            <NodeDetails
              colors={colors}
              selectedNode={selectedNode}
              onClose={() => setSelectedNode(null)}
            />
          ) : (
            <div className="flex-1 overflow-y-auto">
              <LegendPanel
                colors={colors}
                visibleSeverities={visibleSeverities}
                visibleEdgeTypes={visibleEdgeTypes}
                onToggleSeverity={handleToggleSeverity}
                onToggleEdgeType={handleToggleEdgeType}
                metadata={data?.metadata}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
