import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_ID, COLORS, BRANDING } from '../config';
import Icon from './Icon';
import * as d3 from 'd3-hierarchy';

// Position hierarchy with DISTINCT colors per position level
const POSITIONS = [
  // Management - Dark Navy
  { id: 'executive', label: 'Executive Manager', level: 0, color: '#1e3a5f', bgColor: '#e0f2fe', department: 'Management' },
  
  // Technical Office - Blues & Teals
  { id: 'head', label: 'Head of Technical Office', level: 1, color: '#0f4c81', bgColor: '#dbeafe', department: 'Technical Office' },
  { id: 'team_leader', label: 'Team Leader', level: 2, color: '#0891b2', bgColor: '#cffafe', department: 'Technical Office' },
  { id: 'senior', label: 'Senior TOE', level: 3, color: '#0d9488', bgColor: '#ccfbf1', department: 'Technical Office' },
  { id: 'toe', label: 'Technical Office Engineer', level: 4, color: '#059669', bgColor: '#d1fae5', department: 'Technical Office' },
  { id: 'junior', label: 'Junior TOE', level: 5, color: '#10b981', bgColor: '#ecfdf5', department: 'Technical Office' },
  { id: 'trainee', label: 'Trainee', level: 6, color: '#6ee7b7', bgColor: '#f0fdf4', department: 'Technical Office' },
  
  // Planning - Oranges (part of Technical Office)
  { id: 'planning_head', label: 'Head of Planning', level: 2, color: '#c2410c', bgColor: '#ffedd5', department: 'Technical Office' },
  { id: 'planning_senior', label: 'Senior Planning Engineer', level: 3, color: '#ea580c', bgColor: '#fed7aa', department: 'Technical Office' },
  { id: 'planning_engineer', label: 'Planning Engineer', level: 4, color: '#f97316', bgColor: '#fef3c7', department: 'Technical Office' },
  
  // Project Management - Purples
  { id: 'senior_pm', label: 'Senior Project Manager', level: 1, color: '#7c3aed', bgColor: '#ede9fe', department: 'Project Management' },
  { id: 'pm', label: 'Project Manager', level: 2, color: '#8b5cf6', bgColor: '#f3e8ff', department: 'Project Management' },
  
  // Site - Greens
  { id: 'site_manager', label: 'Site Manager', level: 2, color: '#047857', bgColor: '#d1fae5', department: 'Site' },
  { id: 'site_engineer', label: 'Site Engineer', level: 3, color: '#059669', bgColor: '#ecfdf5', department: 'Site' },
  { id: 'supervisor', label: 'Supervisor', level: 4, color: '#10b981', bgColor: '#f0fdf4', department: 'Site' },
  
  // MEP - Reds
  { id: 'mep_team_leader', label: 'MEP Team Leader', level: 2, color: '#dc2626', bgColor: '#fee2e2', department: 'MEP' },
  { id: 'mep_senior', label: 'Senior MEP Engineer', level: 3, color: '#ef4444', bgColor: '#fef2f2', department: 'MEP' },
  { id: 'mep_toe', label: 'MEP Technical Office Engineer', level: 4, color: '#f87171', bgColor: '#fff5f5', department: 'MEP' },
  { id: 'mep_junior', label: 'Junior MEP Engineer', level: 5, color: '#fca5a5', bgColor: '#fff8f8', department: 'MEP' },
];

const DEPARTMENTS = ['Management', 'Technical Office', 'Project Management', 'Site', 'MEP'];

const DEPARTMENT_COLORS = {
  'Management': '#1e3a5f',
  'Technical Office': '#0f4c81',
  'Project Management': '#7c3aed',
  'Site': '#047857',
  'MEP': '#dc2626'
};

export default function OrgChart({ projects }) {
  const [engineers, setEngineers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('chart');
  const [selectedDepartment, setSelectedDepartment] = useState('Technical Office');

  useEffect(() => {
    const engineersRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'engineers');
    const unsubEngineers = onSnapshot(engineersRef, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setEngineers(data);
    });

    const assignmentsRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'assignments');
    const unsubAssignments = onSnapshot(assignmentsRef, (snapshot) => {
      setAssignments(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => { unsubEngineers(); unsubAssignments(); };
  }, []);

  const handleSaveEngineer = async (formData) => {
    setLoading(true);
    try {
      if (editingEngineer) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'engineers', editingEngineer.id), formData);
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'engineers'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsModalOpen(false);
      setEditingEngineer(null);
    } catch (err) {
      alert('Error saving engineer');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteEngineer = async (id) => {
    if (!confirm('Remove this team member?')) return;
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'engineers', id));
  };

  const handleAssign = async (engineerId, projectId) => {
    const existing = assignments.find(a => a.engineerId === engineerId && a.projectId === projectId);
    if (existing) {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'assignments', existing.id));
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'assignments'), {
        engineerId,
        projectId,
        assignedAt: serverTimestamp()
      });
    }
  };

  const getEngineerProjects = (engineerId) => {
    return assignments
      .filter(a => a.engineerId === engineerId)
      .map(a => projects.find(p => p.id === a.projectId))
      .filter(Boolean);
  };

  const getEngineersByDepartment = (dept) => {
    return engineers.filter(e => {
      const pos = POSITIONS.find(p => p.id === e.position);
      return pos?.department === dept;
    });
  };

  const totalPeople = engineers.length;
  const totalProjects = projects.length;
  const departmentCounts = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = getEngineersByDepartment(dept).length;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Organization</h1>
          <p className="text-slate-500 text-xs mt-0.5">Team structure & project assignments</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-6 bg-white px-4 py-2 rounded-xl border border-slate-200">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{totalPeople}</p>
              <p className="text-[10px] text-slate-400 uppercase">Team</p>
            </div>
            <div className="w-px h-8 bg-slate-200"></div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-900">{totalProjects}</p>
              <p className="text-[10px] text-slate-400 uppercase">Projects</p>
            </div>
          </div>
          
          <button
            onClick={() => { setEditingEngineer(null); setIsModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 text-white rounded-lg text-sm font-medium"
            style={{ backgroundColor: COLORS.blue }}
          >
            <Icon name="user-plus" size={16} />
            Add Member
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab('chart')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'chart' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          <Icon name="git-branch" size={14} className="inline mr-2" />
          Org Chart
        </button>
        <button
          onClick={() => setActiveTab('list')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'list' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          <Icon name="list" size={14} className="inline mr-2" />
          Team List
        </button>
        <button
          onClick={() => setActiveTab('assignments')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === 'assignments' ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200'}`}
        >
          <Icon name="grid-3x3" size={14} className="inline mr-2" />
          Assignments
        </button>
      </div>

      {activeTab === 'chart' ? (
        <div className="space-y-4">
          {/* Department Selector */}
          <div className="flex gap-2 flex-wrap">
            {DEPARTMENTS.filter(d => departmentCounts[d] > 0).map(dept => (
              <button
                key={dept}
                onClick={() => setSelectedDepartment(dept)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  selectedDepartment === dept 
                    ? 'text-white' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-slate-300'
                }`}
                style={selectedDepartment === dept ? { backgroundColor: DEPARTMENT_COLORS[dept] } : {}}
              >
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: selectedDepartment === dept ? 'white' : DEPARTMENT_COLORS[dept] }}></span>
                {dept}
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${selectedDepartment === dept ? 'bg-white/20' : 'bg-slate-100'}`}>
                  {departmentCounts[dept]}
                </span>
              </button>
            ))}
          </div>

          {/* Org Chart */}
          {getEngineersByDepartment(selectedDepartment).length > 0 ? (
            <D3OrgChart 
              engineers={getEngineersByDepartment(selectedDepartment)}
              allEngineers={engineers}
              getEngineerProjects={getEngineerProjects}
              onEdit={(eng) => { setEditingEngineer(eng); setIsModalOpen(true); }}
              onDelete={handleDeleteEngineer}
              department={selectedDepartment}
            />
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-6">
              <div className="text-center py-16">
                <div className="w-14 h-14 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Icon name="users" size={24} className="text-slate-400" />
                </div>
                <h3 className="text-base font-semibold text-slate-900">No Team Members</h3>
                <p className="text-slate-500 mt-1 text-sm">Add members to {selectedDepartment}</p>
              </div>
            </div>
          )}
        </div>
      ) : activeTab === 'list' ? (
        <TeamListView 
          engineers={engineers} 
          allEngineers={engineers}
          getEngineerProjects={getEngineerProjects}
          onEdit={(eng) => { setEditingEngineer(eng); setIsModalOpen(true); }}
          onDelete={handleDeleteEngineer}
        />
      ) : (
        <AssignmentMatrix 
          engineers={engineers}
          projects={projects}
          assignments={assignments}
          onAssign={handleAssign}
        />
      )}

      {isModalOpen && (
        <EngineerModal
          engineer={editingEngineer}
          engineers={engineers}
          onClose={() => { setIsModalOpen(false); setEditingEngineer(null); }}
          onSave={handleSaveEngineer}
          loading={loading}
        />
      )}
    </div>
  );
}

// =============================================================================
// D3 HIERARCHY ORG CHART - Uses d3-hierarchy for layout, React for rendering
// =============================================================================

function D3OrgChart({ engineers, allEngineers, getEngineerProjects, onEdit, onDelete, department }) {
  const chartRef = useRef(null);
  const containerRef = useRef(null);
  
  // Card dimensions
  const CARD_WIDTH = 200;
  const CARD_HEIGHT = 140;
  const HORIZONTAL_SPACING = 60;  // Space between siblings
  const VERTICAL_SPACING = 80;    // Space between levels
  
  // Build the tree using d3-hierarchy
  const { root, nodes, links, dimensions } = useMemo(() => {
    if (!engineers || engineers.length === 0) {
      return { root: null, nodes: [], links: [], dimensions: { width: 0, height: 0 } };
    }

    // Step 1: Prepare data - handle orphans and find root(s)
    const engineerIds = new Set(engineers.map(e => e.id));
    
    // Find the root node(s) - engineers with no reportsTo or reportsTo not in this department
    const rootCandidates = engineers.filter(e => {
      if (!e.reportsTo) return true;
      // If reportsTo exists but is not in this department's engineers, treat as root
      return !engineerIds.has(e.reportsTo);
    });

    // If no root found, use the highest level person
    if (rootCandidates.length === 0) {
      const sorted = [...engineers].sort((a, b) => {
        const posA = POSITIONS.find(p => p.id === a.position)?.level ?? 99;
        const posB = POSITIONS.find(p => p.id === b.position)?.level ?? 99;
        return posA - posB;
      });
      if (sorted.length > 0) {
        rootCandidates.push(sorted[0]);
      }
    }

    // If still no engineers, return empty
    if (rootCandidates.length === 0) {
      return { root: null, nodes: [], links: [], dimensions: { width: 0, height: 0 } };
    }

    // Step 2: Create a virtual root if multiple top-level people exist
    let dataForStratify;
    let hasVirtualRoot = false;
    
    if (rootCandidates.length > 1) {
      // Create a virtual root node that all root candidates report to
      hasVirtualRoot = true;
      const virtualRoot = { 
        id: '__virtual_root__', 
        name: department, 
        position: null, 
        reportsTo: null,
        isVirtual: true 
      };
      
      dataForStratify = [
        virtualRoot,
        ...engineers.map(e => ({
          ...e,
          // If this is a root candidate, make it report to virtual root
          reportsTo: rootCandidates.some(r => r.id === e.id) ? '__virtual_root__' : e.reportsTo
        }))
      ];
    } else {
      // Single root - ensure it has no reportsTo
      dataForStratify = engineers.map(e => ({
        ...e,
        reportsTo: rootCandidates[0].id === e.id ? null : e.reportsTo
      }));
    }

    // Step 3: Handle orphans - engineers whose reportsTo doesn't exist in dataset
    // Re-assign them to the first root candidate
    const validIds = new Set(dataForStratify.map(e => e.id));
    dataForStratify = dataForStratify.map(e => {
      if (e.reportsTo && !validIds.has(e.reportsTo)) {
        // Orphan - assign to first root or virtual root
        return { 
          ...e, 
          reportsTo: hasVirtualRoot ? '__virtual_root__' : rootCandidates[0].id 
        };
      }
      return e;
    });

    // Step 4: Build hierarchy using d3.stratify
    try {
      const stratify = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.reportsTo);
      
      const hierarchyRoot = stratify(dataForStratify);
      
      // Step 5: Calculate layout using d3.tree
      const treeLayout = d3.tree()
        .nodeSize([CARD_WIDTH + HORIZONTAL_SPACING, CARD_HEIGHT + VERTICAL_SPACING])
        .separation((a, b) => a.parent === b.parent ? 1 : 1.2);
      
      treeLayout(hierarchyRoot);
      
      // Step 6: Get all nodes and links
      let allNodes = hierarchyRoot.descendants();
      let allLinks = hierarchyRoot.links();
      
      // Filter out virtual root from display (but keep its links for children positioning)
      if (hasVirtualRoot) {
        allNodes = allNodes.filter(n => n.data.id !== '__virtual_root__');
        allLinks = allLinks.filter(l => l.source.data.id !== '__virtual_root__');
      }
      
      // Step 7: Calculate bounds and normalize positions
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      allNodes.forEach(node => {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      });
      
      // Add padding
      const padding = 100;
      const width = maxX - minX + CARD_WIDTH + padding * 2;
      const height = maxY - minY + CARD_HEIGHT + padding * 2;
      
      // Offset to make all coordinates positive
      const offsetX = -minX + padding + CARD_WIDTH / 2;
      const offsetY = -minY + padding;
      
      // Apply offset to nodes
      allNodes.forEach(node => {
        node.x += offsetX;
        node.y += offsetY;
      });
      
      return {
        root: hierarchyRoot,
        nodes: allNodes,
        links: allLinks,
        dimensions: { width: Math.max(width, 400), height: Math.max(height, 300) }
      };
      
    } catch (err) {
      console.error('D3 hierarchy error:', err);
      return { root: null, nodes: [], links: [], dimensions: { width: 0, height: 0 } };
    }
  }, [engineers, department]);

  // Download as PNG
  const handleDownload = async () => {
    if (!chartRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(chartRef.current, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
        useCORS: true
      });
      const link = document.createElement('a');
      const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: '2-digit', day: '2-digit' }).replace(/\//g, '-');
      link.download = `Sigma-OrgChart-${department}-${date}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed');
    }
  };

  // Person Card Component
  const PersonCard = ({ node }) => {
    const person = node.data;
    if (person.isVirtual) return null; // Don't render virtual root
    
    const pos = POSITIONS.find(p => p.id === person.position);
    const projects = getEngineerProjects(person.id);
    
    return (
      <div 
        className="absolute transform -translate-x-1/2 transition-all hover:-translate-y-1 group"
        style={{ 
          left: node.x,
          top: node.y,
          width: CARD_WIDTH
        }}
      >
        <div 
          className="rounded-2xl shadow-lg border-2 transition-all hover:shadow-xl bg-white"
          style={{ 
            backgroundColor: pos?.bgColor || '#f8fafc',
            borderColor: pos?.color || '#64748B'
          }}
        >
          {/* Color accent bar */}
          <div 
            className="h-2 rounded-t-xl" 
            style={{ backgroundColor: pos?.color || '#64748B' }} 
          />
          
          <div className="p-3">
            {/* Avatar */}
            <div className="flex justify-center mb-2">
              <div 
                className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-base shadow-md border-3 border-white"
                style={{ backgroundColor: pos?.color || '#64748B' }}
              >
                {person.name?.charAt(0) || '?'}
              </div>
            </div>
            
            {/* Name */}
            <h3 className="font-bold text-slate-800 text-xs text-center truncate mb-1.5">
              {person.name}
            </h3>
            
            {/* Position badge */}
            <div className="flex justify-center mb-1.5">
              <span 
                className="text-[9px] font-semibold px-2 py-0.5 rounded-full text-white shadow-sm"
                style={{ backgroundColor: pos?.color || '#64748B' }}
              >
                {pos?.label || 'Team Member'}
              </span>
            </div>
            
            {/* Projects */}
            {projects.length > 0 && !['executive', 'head'].includes(person.position) && (
              <div className="flex flex-wrap gap-1 justify-center">
                {projects.slice(0, 2).map(p => (
                  <span key={p.id} className="text-[8px] bg-white/80 text-slate-600 px-1.5 py-0.5 rounded font-medium border border-slate-200">
                    {p.name}
                  </span>
                ))}
                {projects.length > 2 && (
                  <span className="text-[8px] text-slate-400 font-medium">+{projects.length - 2}</span>
                )}
              </div>
            )}
          </div>
          
          {/* Action buttons */}
          <div className="absolute -top-2 -right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-all z-10">
            <button 
              onClick={() => onEdit(person)} 
              className="p-1.5 bg-white border border-slate-200 rounded-full shadow-md hover:bg-blue-50 hover:border-blue-300"
            >
              <Icon name="pencil" size={10} className="text-slate-600" />
            </button>
            <button 
              onClick={() => onDelete(person.id)} 
              className="p-1.5 bg-white border border-slate-200 rounded-full shadow-md hover:bg-red-50 hover:border-red-300"
            >
              <Icon name="trash-2" size={10} className="text-red-500" />
            </button>
          </div>
        </div>
      </div>
    );
  };

  // Generate SVG path for connector lines (curved)
  const generatePath = (link) => {
    const sourceX = link.source.x;
    const sourceY = link.source.y + CARD_HEIGHT; // Bottom of source card
    const targetX = link.target.x;
    const targetY = link.target.y; // Top of target card
    
    // Curved path using cubic bezier
    const midY = (sourceY + targetY) / 2;
    
    return `M ${sourceX} ${sourceY} 
            C ${sourceX} ${midY}, 
              ${targetX} ${midY}, 
              ${targetX} ${targetY}`;
  };

  const currentDate = new Date().toLocaleDateString('en-US', { 
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' 
  });

  if (!root || nodes.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-slate-200 p-6">
        <div className="text-center py-16">
          <Icon name="users" size={24} className="text-slate-400 mx-auto mb-4" />
          <p className="text-slate-500">No hierarchy data available</p>
        </div>
      </div>
    );
  }

  // Get unique positions for legend
  const uniquePositions = [...new Set(nodes.map(n => n.data.position))].filter(Boolean);
  const legendPositions = uniquePositions.map(posId => POSITIONS.find(p => p.id === posId)).filter(Boolean);

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-200 px-6 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-white">
        <div>
          <h2 className="font-bold text-slate-900 text-lg">{department}</h2>
          <p className="text-xs text-slate-500">{currentDate}</p>
        </div>
        
        <button
          onClick={handleDownload}
          className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-sm hover:bg-slate-800 transition-all shadow-md"
        >
          <Icon name="download" size={14} />
          Export PNG
        </button>
      </div>
      
      {/* Chart Container with Scroll */}
      <div 
        ref={containerRef}
        className="overflow-auto bg-gradient-to-br from-white via-slate-50/50 to-white"
        style={{ maxHeight: '70vh' }}
      >
        <div 
          ref={chartRef}
          className="relative"
          style={{ 
            width: dimensions.width,
            height: dimensions.height,
            minWidth: '100%',
            minHeight: '400px'
          }}
        >
          {/* SVG Layer for Connection Lines */}
          <svg 
            className="absolute inset-0 pointer-events-none"
            style={{ width: dimensions.width, height: dimensions.height }}
          >
            <defs>
              {/* Gradient for lines */}
              <linearGradient id="lineGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#94a3b8" />
                <stop offset="100%" stopColor="#cbd5e1" />
              </linearGradient>
            </defs>
            
            {links.map((link, i) => (
              <path
                key={i}
                d={generatePath(link)}
                fill="none"
                stroke="url(#lineGradient)"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}
          </svg>
          
          {/* Node Cards Layer */}
          {nodes.map(node => (
            <PersonCard key={node.data.id} node={node} />
          ))}
          
          {/* Legend */}
          <div className="absolute top-4 left-4 bg-white/95 backdrop-blur-sm rounded-xl p-3 border border-slate-100 shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 mb-2">POSITIONS</p>
            <div className="space-y-1">
              {legendPositions.map(pos => (
                <div key={pos.id} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded" style={{ backgroundColor: pos.color }}></div>
                  <span className="text-[10px] text-slate-600">{pos.label}</span>
                </div>
              ))}
            </div>
          </div>
          
          {/* Logo watermark */}
          <div className="absolute bottom-4 right-4 flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white/95 backdrop-blur-sm px-3 py-2 rounded-xl shadow-sm border border-slate-100">
              <div 
                className="w-7 h-7 rounded-lg flex items-center justify-center" 
                style={{ backgroundColor: COLORS.blue }}
              >
                <span className="text-white font-bold text-xs">S</span>
              </div>
              <div className="text-left">
                <p className="font-bold text-slate-800 text-xs">{BRANDING?.companyName || 'Sigma Contractors'}</p>
                <p className="text-[9px] text-slate-500">Technical Office HQ</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// TEAM LIST VIEW
// =============================================================================

function TeamListView({ engineers, allEngineers, getEngineerProjects, onEdit, onDelete }) {
  const getManagerName = (reportsTo) => {
    if (!reportsTo) return '—';
    const manager = allEngineers.find(e => e.id === reportsTo);
    return manager?.name || '—';
  };

  const sortedEngineers = [...engineers].sort((a, b) => {
    const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
    const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
    if (posA !== posB) return posA - posB;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <table className="w-full">
        <thead>
          <tr className="bg-slate-50 border-b border-slate-200">
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Name</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3">Position</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden sm:table-cell">Reports To</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden md:table-cell">Projects</th>
            <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 hidden lg:table-cell">Contact</th>
            <th className="text-right text-xs font-semibold text-slate-600 px-4 py-3">Actions</th>
          </tr>
        </thead>
        <tbody>
          {sortedEngineers.map(eng => {
            const pos = POSITIONS.find(p => p.id === eng.position);
            const engProjects = getEngineerProjects(eng.id);
            return (
              <tr key={eng.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div 
                      className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-semibold"
                      style={{ backgroundColor: pos?.color || '#94A3B8' }}
                    >
                      {eng.name?.charAt(0) || '?'}
                    </div>
                    <span className="font-medium text-slate-900 text-sm">{eng.name}</span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span 
                    className="text-xs font-medium px-2 py-1 rounded-full text-white"
                    style={{ backgroundColor: pos?.color || '#94A3B8' }}
                  >
                    {pos?.label || 'Unknown'}
                  </span>
                </td>
                <td className="px-4 py-3 hidden sm:table-cell">
                  <span className="text-xs text-slate-500">{getManagerName(eng.reportsTo)}</span>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <div className="flex flex-wrap gap-1">
                    {engProjects.slice(0, 2).map(p => (
                      <span key={p.id} className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{p.name}</span>
                    ))}
                    {engProjects.length > 2 && <span className="text-[10px] text-slate-400">+{engProjects.length - 2}</span>}
                    {engProjects.length === 0 && <span className="text-[10px] text-slate-300">None</span>}
                  </div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 hidden lg:table-cell">{eng.phone || eng.email || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => onEdit(eng)} className="p-1.5 hover:bg-slate-100 rounded text-slate-400 hover:text-slate-600">
                    <Icon name="pencil" size={14} />
                  </button>
                  <button onClick={() => onDelete(eng.id)} className="p-1.5 hover:bg-red-50 rounded text-slate-400 hover:text-red-500 ml-1">
                    <Icon name="trash-2" size={14} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {engineers.length === 0 && <div className="text-center py-12 text-slate-400">No team members yet</div>}
    </div>
  );
}

// =============================================================================
// ASSIGNMENT MATRIX
// =============================================================================

function AssignmentMatrix({ engineers, projects, assignments, onAssign }) {
  const sortedEngineers = [...engineers].sort((a, b) => {
    const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
    const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
    return posA - posB;
  });

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 sticky left-0 bg-slate-50 min-w-[200px]">Team Member</th>
              {projects.map(p => (
                <th key={p.id} className="text-center text-xs font-semibold text-slate-600 px-3 py-3 min-w-[100px]">
                  <div className="truncate max-w-[100px]" title={p.name}>{p.name}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sortedEngineers.map(eng => {
              const pos = POSITIONS.find(p => p.id === eng.position);
              const skipAssignment = ['executive', 'head'].includes(eng.position);
              
              return (
                <tr key={eng.id} className="border-b border-slate-100 hover:bg-slate-50">
                  <td className="px-4 py-3 sticky left-0 bg-white">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: pos?.color || '#94A3B8' }}></div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{eng.name}</p>
                        <p className="text-[10px] text-slate-400 truncate">{pos?.label || 'Unknown'}</p>
                      </div>
                    </div>
                  </td>
                  {projects.map(p => {
                    const isAssigned = assignments.some(a => a.engineerId === eng.id && a.projectId === p.id);
                    if (skipAssignment) {
                      return <td key={p.id} className="text-center px-3 py-3"><span className="text-[10px] text-slate-300">—</span></td>;
                    }
                    return (
                      <td key={p.id} className="text-center px-3 py-3">
                        <button
                          onClick={() => onAssign(eng.id, p.id)}
                          className={`w-8 h-8 rounded-lg transition-all ${isAssigned ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-300 hover:bg-slate-200'}`}
                        >
                          <Icon name={isAssigned ? 'check' : 'plus'} size={16} className="mx-auto" />
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {engineers.length === 0 && <div className="text-center py-12 text-slate-400">Add team members to start</div>}
      </div>
    </div>
  );
}

// =============================================================================
// ENGINEER MODAL
// =============================================================================

function EngineerModal({ engineer, engineers, onClose, onSave, loading }) {
  const [formData, setFormData] = useState({
    name: engineer?.name || '',
    position: engineer?.position || 'toe',
    phone: engineer?.phone || '',
    email: engineer?.email || '',
    reportsTo: engineer?.reportsTo || ''
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) return alert('Name is required');
    onSave(formData);
  };

  const currentPos = POSITIONS.find(p => p.id === formData.position);
  
  // Get managers from all engineers
  const potentialManagers = engineers.filter(e => {
    if (e.id === engineer?.id) return false;
    const pos = POSITIONS.find(p => p.id === e.position);
    return pos && currentPos && pos.level < currentPos.level;
  }).sort((a, b) => {
    const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
    const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
    return posA - posB;
  });

  const positionsByDept = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = POSITIONS.filter(p => p.department === dept);
    return acc;
  }, {});

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-slate-100">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">{engineer ? 'Edit' : 'Add'} Team Member</h2>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <Icon name="x" size={20} className="text-slate-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Eng. Ahmed Hassan"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Position *</label>
            <select
              value={formData.position}
              onChange={(e) => setFormData({ ...formData, position: e.target.value, reportsTo: '' })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
            >
              {DEPARTMENTS.map(dept => (
                <optgroup key={dept} label={dept}>
                  {positionsByDept[dept].map(pos => (
                    <option key={pos.id} value={pos.id}>{pos.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Reports To</label>
            <select
              value={formData.reportsTo}
              onChange={(e) => setFormData({ ...formData, reportsTo: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
            >
              <option value="">— No Manager (Top Level) —</option>
              {potentialManagers.map(m => {
                const mPos = POSITIONS.find(p => p.id === m.position);
                return (
                  <option key={m.id} value={m.id}>
                    {m.name} ({mPos?.label})
                  </option>
                );
              })}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Phone</label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+201234567890"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="ahmed@sigma.com"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button type="button" onClick={onClose} className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 px-4 py-3 bg-slate-900 text-white rounded-xl text-sm font-medium disabled:opacity-50">
              {loading ? 'Saving...' : (engineer ? 'Update' : 'Add')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
