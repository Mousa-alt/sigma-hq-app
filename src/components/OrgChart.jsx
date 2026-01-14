import { useState, useEffect, useRef, useMemo } from 'react';
import { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { APP_ID, COLORS, BRANDING } from '../config';
import Icon from './Icon';
import * as d3 from 'd3-hierarchy';

// Position hierarchy - Professional color scheme
const POSITIONS = [
  // Management
  { id: 'executive', label: 'Executive Manager', level: 0, color: '#000000', bgColor: '#f1f5f9', department: 'Management' },
  
  // Technical Office
  { id: 'head', label: 'Head of Technical Office', level: 1, color: '#000000', bgColor: '#f1f5f9', department: 'Technical Office' },
  { id: 'team_leader', label: 'Team Leader', level: 2, color: '#1e3a8a', bgColor: '#f1f5f9', department: 'Technical Office' },
  { id: 'senior', label: 'Senior TOE', level: 3, color: '#2563eb', bgColor: '#f8fafc', department: 'Technical Office' },
  { id: 'toe', label: 'Technical Office Engineer', level: 4, color: '#60a5fa', bgColor: '#f8fafc', department: 'Technical Office' },
  { id: 'junior', label: 'Junior TOE', level: 5, color: '#166534', bgColor: '#f8fafc', department: 'Technical Office' },
  { id: 'trainee', label: 'Trainee', level: 6, color: '#15803d', bgColor: '#f8fafc', department: 'Technical Office' },
  
  // Planning
  { id: 'planning_head', label: 'Head of Planning', level: 2, color: '#1e3a8a', bgColor: '#f8fafc', department: 'Technical Office' },
  { id: 'planning_senior', label: 'Senior Planning Engineer', level: 3, color: '#1e3a8a', bgColor: '#f8fafc', department: 'Technical Office' },
  { id: 'planning_engineer', label: 'Planning Engineer', level: 4, color: '#3b82f6', bgColor: '#f8fafc', department: 'Technical Office' },
  
  // Project Management
  { id: 'senior_pm', label: 'Senior Project Manager', level: 1, color: '#312e81', bgColor: '#f8fafc', department: 'Project Management' },
  { id: 'pm', label: 'Project Manager', level: 2, color: '#4338ca', bgColor: '#f8fafc', department: 'Project Management' },
  
  // Site
  { id: 'site_manager', label: 'Site Manager', level: 2, color: '#14532d', bgColor: '#f8fafc', department: 'Site' },
  { id: 'site_engineer', label: 'Site Engineer', level: 3, color: '#166534', bgColor: '#f8fafc', department: 'Site' },
  { id: 'supervisor', label: 'Supervisor', level: 4, color: '#15803d', bgColor: '#f8fafc', department: 'Site' },
  
  // MEP
  { id: 'mep_team_leader', label: 'MEP Team Leader', level: 2, color: '#7f1d1d', bgColor: '#f8fafc', department: 'MEP' },
  { id: 'mep_senior', label: 'Senior MEP Engineer', level: 3, color: '#991b1b', bgColor: '#f8fafc', department: 'MEP' },
  { id: 'mep_toe', label: 'MEP Technical Office Engineer', level: 4, color: '#b91c1c', bgColor: '#f8fafc', department: 'MEP' },
  { id: 'mep_junior', label: 'Junior MEP Engineer', level: 5, color: '#dc2626', bgColor: '#f8fafc', department: 'MEP' },
];

const DEPARTMENTS = ['Management', 'Technical Office', 'Project Management', 'Site', 'MEP'];

const DEPARTMENT_COLORS = {
  'Management': '#000000',
  'Technical Office': '#000000',
  'Project Management': '#312e81',
  'Site': '#14532d',
  'MEP': '#7f1d1d'
};

export default function OrgChart({ projects }) {
  const [engineers, setEngineers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [planningProjects, setPlanningProjects] = useState([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isPlanningModalOpen, setIsPlanningModalOpen] = useState(false);
  const [editingEngineer, setEditingEngineer] = useState(null);
  const [editingPlanningProject, setEditingPlanningProject] = useState(null);
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

    // Listen to planning projects
    const planningRef = collection(db, 'artifacts', APP_ID, 'public', 'data', 'planningProjects');
    const unsubPlanning = onSnapshot(planningRef, (snapshot) => {
      setPlanningProjects(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), isPlanning: true })));
    });

    return () => { unsubEngineers(); unsubAssignments(); unsubPlanning(); };
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

  const handleAssign = async (engineerId, projectId, isPlanning = false) => {
    const existing = assignments.find(a => a.engineerId === engineerId && a.projectId === projectId);
    if (existing) {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'assignments', existing.id));
    } else {
      await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'assignments'), {
        engineerId,
        projectId,
        isPlanning, // Track if this is a planning project assignment
        assignedAt: serverTimestamp()
      });
    }
  };

  // Planning project handlers
  const handleSavePlanningProject = async (formData) => {
    setLoading(true);
    try {
      if (editingPlanningProject) {
        await updateDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'planningProjects', editingPlanningProject.id), formData);
      } else {
        await addDoc(collection(db, 'artifacts', APP_ID, 'public', 'data', 'planningProjects'), {
          ...formData,
          createdAt: serverTimestamp()
        });
      }
      setIsPlanningModalOpen(false);
      setEditingPlanningProject(null);
    } catch (err) {
      alert('Error saving planning project');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePlanningProject = async (id) => {
    if (!confirm('Delete this planning project? All assignments to it will be removed.')) return;
    
    // Delete all assignments to this planning project
    const relatedAssignments = assignments.filter(a => a.projectId === id);
    for (const a of relatedAssignments) {
      await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'assignments', a.id));
    }
    
    await deleteDoc(doc(db, 'artifacts', APP_ID, 'public', 'data', 'planningProjects', id));
  };

  const getEngineerProjects = (engineerId) => {
    return assignments
      .filter(a => a.engineerId === engineerId)
      .map(a => {
        // Check active projects first
        const activeProject = projects.find(p => p.id === a.projectId);
        if (activeProject) return activeProject;
        // Check planning projects
        const planningProject = planningProjects.find(p => p.id === a.projectId);
        return planningProject;
      })
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
  const totalPlanningProjects = planningProjects.length;
  const departmentCounts = DEPARTMENTS.reduce((acc, dept) => {
    acc[dept] = getEngineersByDepartment(dept).length;
    return acc;
  }, {});

  // Combine all projects for the matrix
  const allProjects = [...projects, ...planningProjects];

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
              <p className="text-[10px] text-slate-400 uppercase">Active</p>
            </div>
            {totalPlanningProjects > 0 && (
              <>
                <div className="w-px h-8 bg-slate-200"></div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-purple-600">{totalPlanningProjects}</p>
                  <p className="text-[10px] text-purple-400 uppercase">Planning</p>
                </div>
              </>
            )}
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
        <div className="space-y-4">
          {/* Assignment Matrix Header with Add Planning Project */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <span className="w-3 h-3 rounded bg-slate-200"></span>
                <span>Active Projects</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-purple-500">
                <span className="w-3 h-3 rounded bg-purple-100 border-2 border-dashed border-purple-300"></span>
                <span>Planning Projects</span>
              </div>
            </div>
            <button
              onClick={() => { setEditingPlanningProject(null); setIsPlanningModalOpen(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg text-sm font-medium hover:bg-purple-100 transition-all"
            >
              <span>🔮</span>
              Add Planning Project
            </button>
          </div>
          
          <AssignmentMatrix 
            engineers={engineers}
            projects={projects}
            planningProjects={planningProjects}
            assignments={assignments}
            onAssign={handleAssign}
            onEditPlanningProject={(p) => { setEditingPlanningProject(p); setIsPlanningModalOpen(true); }}
            onDeletePlanningProject={handleDeletePlanningProject}
          />
        </div>
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

      {isPlanningModalOpen && (
        <PlanningProjectModal
          project={editingPlanningProject}
          onClose={() => { setIsPlanningModalOpen(false); setEditingPlanningProject(null); }}
          onSave={handleSavePlanningProject}
          loading={loading}
        />
      )}
    </div>
  );
}

// =============================================================================
// D3 HIERARCHY ORG CHART - Pure SVG for reliable export
// =============================================================================

function D3OrgChart({ engineers, allEngineers, getEngineerProjects, onEdit, onDelete, department }) {
  const svgRef = useRef(null);
  const containerRef = useRef(null);
  
  // Card dimensions
  const CARD_WIDTH = 200;
  const CARD_HEIGHT = 140;
  const HORIZONTAL_SPACING = 60;
  const VERTICAL_SPACING = 80;
  
  // Build the tree using d3-hierarchy
  const { root, nodes, links, dimensions } = useMemo(() => {
    if (!engineers || engineers.length === 0) {
      return { root: null, nodes: [], links: [], dimensions: { width: 0, height: 0 } };
    }

    const engineerIds = new Set(engineers.map(e => e.id));
    
    const rootCandidates = engineers.filter(e => {
      if (!e.reportsTo) return true;
      return !engineerIds.has(e.reportsTo);
    });

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

    if (rootCandidates.length === 0) {
      return { root: null, nodes: [], links: [], dimensions: { width: 0, height: 0 } };
    }

    let dataForStratify;
    let hasVirtualRoot = false;
    
    if (rootCandidates.length > 1) {
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
          reportsTo: rootCandidates.some(r => r.id === e.id) ? '__virtual_root__' : e.reportsTo
        }))
      ];
    } else {
      dataForStratify = engineers.map(e => ({
        ...e,
        reportsTo: rootCandidates[0].id === e.id ? null : e.reportsTo
      }));
    }

    const validIds = new Set(dataForStratify.map(e => e.id));
    dataForStratify = dataForStratify.map(e => {
      if (e.reportsTo && !validIds.has(e.reportsTo)) {
        return { 
          ...e, 
          reportsTo: hasVirtualRoot ? '__virtual_root__' : rootCandidates[0].id 
        };
      }
      return e;
    });

    try {
      const stratify = d3.stratify()
        .id(d => d.id)
        .parentId(d => d.reportsTo);
      
      const hierarchyRoot = stratify(dataForStratify);
      
      const treeLayout = d3.tree()
        .nodeSize([CARD_WIDTH + HORIZONTAL_SPACING, CARD_HEIGHT + VERTICAL_SPACING])
        .separation((a, b) => a.parent === b.parent ? 1 : 1.2);
      
      treeLayout(hierarchyRoot);
      
      let allNodes = hierarchyRoot.descendants();
      let allLinks = hierarchyRoot.links();
      
      if (hasVirtualRoot) {
        allNodes = allNodes.filter(n => n.data.id !== '__virtual_root__');
        allLinks = allLinks.filter(l => l.source.data.id !== '__virtual_root__');
      }
      
      let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      allNodes.forEach(node => {
        minX = Math.min(minX, node.x);
        maxX = Math.max(maxX, node.x);
        minY = Math.min(minY, node.y);
        maxY = Math.max(maxY, node.y);
      });
      
      const padding = 120;
      const width = maxX - minX + CARD_WIDTH + padding * 2;
      const height = maxY - minY + CARD_HEIGHT + padding * 2;
      
      const offsetX = -minX + padding + CARD_WIDTH / 2;
      const offsetY = -minY + padding;
      
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

  // Export using save-svg-as-png for reliable output
  const handleDownload = async () => {
    if (!svgRef.current) return;
    try {
      const { saveSvgAsPng } = await import('save-svg-as-png');
      const date = new Date().toLocaleDateString('en-US', { 
        year: 'numeric', month: '2-digit', day: '2-digit' 
      }).replace(/\//g, '-');
      
      await saveSvgAsPng(svgRef.current, `Sigma-OrgChart-${department.replace(/\s+/g, '_')}-${date}.png`, {
        scale: 3,
        backgroundColor: '#ffffff',
        encoderOptions: 1.0
      });
    } catch (err) {
      console.error('Download failed:', err);
      alert('Download failed');
    }
  };

  // Generate SVG path for connector lines
  const generatePath = (link) => {
    const sourceX = link.source.x;
    const sourceY = link.source.y + CARD_HEIGHT;
    const targetX = link.target.x;
    const targetY = link.target.y;
    
    const midY = (sourceY + targetY) / 2;
    
    return `M ${sourceX} ${sourceY} C ${sourceX} ${midY}, ${targetX} ${midY}, ${targetX} ${targetY}`;
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
      
      {/* Chart Container */}
      <div 
        ref={containerRef}
        className="overflow-auto bg-gradient-to-br from-white via-slate-50/50 to-white"
        style={{ maxHeight: '70vh' }}
      >
        {/* Pure SVG Chart - Everything in one SVG for reliable export */}
        <svg 
          ref={svgRef}
          width={dimensions.width}
          height={dimensions.height}
          style={{ minWidth: '100%', minHeight: '400px', fontFamily: 'system-ui, -apple-system, sans-serif' }}
        >
          {/* Background */}
          <rect width={dimensions.width} height={dimensions.height} fill="#ffffff" />
          
          {/* Connection Lines */}
          <g className="links">
            {links.map((link, i) => (
              <path
                key={i}
                d={generatePath(link)}
                fill="none"
                stroke="#94a3b8"
                strokeWidth="2"
                strokeLinecap="round"
              />
            ))}
          </g>
          
          {/* Person Cards using foreignObject for HTML rendering */}
          {nodes.map(node => {
            const person = node.data;
            if (person.isVirtual) return null;
            
            const pos = POSITIONS.find(p => p.id === person.position);
            const projects = getEngineerProjects(person.id);
            const cardX = node.x - CARD_WIDTH / 2;
            const cardY = node.y;
            
            return (
              <g key={person.id} className="node">
                {/* Card Background */}
                <rect
                  x={cardX}
                  y={cardY}
                  width={CARD_WIDTH}
                  height={CARD_HEIGHT}
                  rx="16"
                  ry="16"
                  fill={pos?.bgColor || '#f8fafc'}
                  stroke={pos?.color || '#64748B'}
                  strokeWidth="2"
                />
                
                {/* Color accent bar */}
                <rect
                  x={cardX}
                  y={cardY}
                  width={CARD_WIDTH}
                  height="8"
                  rx="16"
                  ry="16"
                  fill={pos?.color || '#64748B'}
                />
                <rect
                  x={cardX}
                  y={cardY + 6}
                  width={CARD_WIDTH}
                  height="4"
                  fill={pos?.color || '#64748B'}
                />
                
                {/* Avatar Circle */}
                <circle
                  cx={node.x}
                  cy={cardY + 40}
                  r="24"
                  fill={pos?.color || '#64748B'}
                />
                <text
                  x={node.x}
                  y={cardY + 46}
                  textAnchor="middle"
                  fill="white"
                  fontSize="16"
                  fontWeight="bold"
                >
                  {person.name?.charAt(0) || '?'}
                </text>
                
                {/* Name */}
                <text
                  x={node.x}
                  y={cardY + 80}
                  textAnchor="middle"
                  fill="#1e293b"
                  fontSize="12"
                  fontWeight="bold"
                >
                  {person.name?.length > 18 ? person.name.substring(0, 18) + '...' : person.name}
                </text>
                
                {/* Position Badge */}
                <rect
                  x={node.x - 60}
                  y={cardY + 90}
                  width="120"
                  height="18"
                  rx="9"
                  fill={pos?.color || '#64748B'}
                />
                <text
                  x={node.x}
                  y={cardY + 103}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="600"
                >
                  {pos?.label || 'Team Member'}
                </text>
                
                {/* Projects */}
                {projects.length > 0 && !['executive', 'head'].includes(person.position) && (
                  <>
                    {projects.slice(0, 2).map((p, idx) => (
                      <g key={p.id}>
                        <rect
                          x={cardX + 10 + idx * 55}
                          y={cardY + 115}
                          width="50"
                          height="16"
                          rx="4"
                          fill={p.isPlanning ? '#f3e8ff' : 'white'}
                          stroke={p.isPlanning ? '#c084fc' : '#e2e8f0'}
                          strokeWidth="1"
                          strokeDasharray={p.isPlanning ? '3,2' : 'none'}
                        />
                        <text
                          x={cardX + 35 + idx * 55}
                          y={cardY + 126}
                          textAnchor="middle"
                          fill={p.isPlanning ? '#7c3aed' : '#475569'}
                          fontSize="8"
                          fontWeight="500"
                        >
                          {p.name?.length > 8 ? p.name.substring(0, 8) : p.name}
                        </text>
                      </g>
                    ))}
                    {projects.length > 2 && (
                      <text
                        x={cardX + CARD_WIDTH - 20}
                        y={cardY + 126}
                        textAnchor="middle"
                        fill="#94a3b8"
                        fontSize="8"
                      >
                        +{projects.length - 2}
                      </text>
                    )}
                  </>
                )}
              </g>
            );
          })}
          
          {/* Legend */}
          <g transform="translate(20, 20)">
            <rect x="0" y="0" width="160" height={legendPositions.length * 18 + 30} rx="12" fill="white" fillOpacity="0.95" stroke="#e2e8f0" />
            <text x="12" y="20" fill="#64748b" fontSize="10" fontWeight="600">POSITIONS</text>
            {legendPositions.map((pos, idx) => (
              <g key={pos.id} transform={`translate(12, ${35 + idx * 18})`}>
                <rect x="0" y="0" width="12" height="12" rx="3" fill={pos.color} />
                <text x="18" y="10" fill="#475569" fontSize="10">{pos.label}</text>
              </g>
            ))}
          </g>
          
          {/* Logo Watermark - Just the logo on white background, no frame */}
          <image 
            href={BRANDING?.logo || "https://raw.githubusercontent.com/Mousa-alt/Sigma-logo-PORTRAIT/main/Sigma%20landscape.png"}
            x={dimensions.width - 180}
            y={dimensions.height - 45}
            width="160"
            height="35"
            preserveAspectRatio="xMidYMid meet"
          />
        </svg>
      </div>
      
      {/* Hover Actions - Rendered outside SVG */}
      <div className="absolute inset-0 pointer-events-none">
        {nodes.map(node => {
          const person = node.data;
          if (person.isVirtual) return null;
          
          return (
            <div
              key={`actions-${person.id}`}
              className="absolute pointer-events-auto opacity-0 hover:opacity-100 transition-all"
              style={{
                left: node.x + CARD_WIDTH / 2 - 30,
                top: node.y - 10,
              }}
            >
              <div className="flex gap-1">
                <button 
                  onClick={() => onEdit(person)} 
                  className="p-1.5 bg-white border border-slate-200 rounded-full shadow-md hover:bg-blue-50"
                >
                  <Icon name="pencil" size={10} className="text-slate-600" />
                </button>
                <button 
                  onClick={() => onDelete(person.id)} 
                  className="p-1.5 bg-white border border-slate-200 rounded-full shadow-md hover:bg-red-50"
                >
                  <Icon name="trash-2" size={10} className="text-red-500" />
                </button>
              </div>
            </div>
          );
        })}
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
                      <span 
                        key={p.id} 
                        className={`text-[10px] px-2 py-0.5 rounded-full ${
                          p.isPlanning 
                            ? 'bg-purple-50 text-purple-600 border border-dashed border-purple-300' 
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        {p.isPlanning && '🔮 '}{p.name}
                      </span>
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
// ASSIGNMENT MATRIX - Now includes Planning Projects
// =============================================================================

function AssignmentMatrix({ engineers, projects, planningProjects, assignments, onAssign, onEditPlanningProject, onDeletePlanningProject }) {
  const sortedEngineers = [...engineers].sort((a, b) => {
    const posA = POSITIONS.find(p => p.id === a.position)?.level || 99;
    const posB = POSITIONS.find(p => p.id === b.position)?.level || 99;
    return posA - posB;
  });

  // Combine active and planning projects
  const allProjects = [
    ...projects.map(p => ({ ...p, isPlanning: false })),
    ...planningProjects.map(p => ({ ...p, isPlanning: true }))
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="text-left text-xs font-semibold text-slate-600 px-4 py-3 sticky left-0 bg-slate-50 min-w-[200px]">Team Member</th>
              {allProjects.map(p => (
                <th 
                  key={p.id} 
                  className={`text-center text-xs font-semibold px-3 py-3 min-w-[100px] ${
                    p.isPlanning ? 'bg-purple-50' : ''
                  }`}
                >
                  <div className="flex flex-col items-center gap-1">
                    {p.isPlanning && <span className="text-base">🔮</span>}
                    <div 
                      className={`truncate max-w-[100px] ${p.isPlanning ? 'text-purple-700' : 'text-slate-600'}`} 
                      title={p.name}
                    >
                      {p.name}
                    </div>
                    {p.isPlanning && (
                      <div className="flex gap-1">
                        <button 
                          onClick={() => onEditPlanningProject(p)}
                          className="p-1 hover:bg-purple-100 rounded text-purple-400 hover:text-purple-600"
                          title="Edit"
                        >
                          <Icon name="pencil" size={10} />
                        </button>
                        <button 
                          onClick={() => onDeletePlanningProject(p.id)}
                          className="p-1 hover:bg-red-100 rounded text-purple-400 hover:text-red-500"
                          title="Delete"
                        >
                          <Icon name="trash-2" size={10} />
                        </button>
                      </div>
                    )}
                  </div>
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
                  {allProjects.map(p => {
                    const isAssigned = assignments.some(a => a.engineerId === eng.id && a.projectId === p.id);
                    if (skipAssignment) {
                      return (
                        <td 
                          key={p.id} 
                          className={`text-center px-3 py-3 ${p.isPlanning ? 'bg-purple-50/50' : ''}`}
                        >
                          <span className="text-[10px] text-slate-300">—</span>
                        </td>
                      );
                    }
                    return (
                      <td 
                        key={p.id} 
                        className={`text-center px-3 py-3 ${p.isPlanning ? 'bg-purple-50/50' : ''}`}
                      >
                        <button
                          onClick={() => onAssign(eng.id, p.id, p.isPlanning)}
                          className={`w-8 h-8 rounded-lg transition-all ${
                            isAssigned 
                              ? p.isPlanning 
                                ? 'bg-purple-100 text-purple-600 border-2 border-dashed border-purple-300' 
                                : 'bg-emerald-100 text-emerald-600'
                              : p.isPlanning
                                ? 'bg-purple-50 text-purple-300 hover:bg-purple-100 border border-dashed border-purple-200'
                                : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                          }`}
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
        {allProjects.length === 0 && engineers.length > 0 && (
          <div className="text-center py-12 text-slate-400">
            No projects yet. Add a planning project to start resource planning.
          </div>
        )}
      </div>
    </div>
  );
}

// =============================================================================
// PLANNING PROJECT MODAL
// =============================================================================

function PlanningProjectModal({ project, onClose, onSave, loading }) {
  const [formData, setFormData] = useState({
    name: project?.name || '',
    notes: project?.notes || '',
    expectedStart: project?.expectedStart || '',
    status: project?.status || 'study'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name) return alert('Project name is required');
    onSave(formData);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden max-h-[90vh] flex flex-col">
        <div className="p-6 border-b border-purple-100 bg-gradient-to-r from-purple-50 to-white">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-2xl">🔮</span>
              <h2 className="text-lg font-semibold text-slate-900">
                {project ? 'Edit' : 'Add'} Planning Project
              </h2>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <Icon name="x" size={20} className="text-slate-400" />
            </button>
          </div>
          <p className="text-xs text-slate-500 mt-2 ml-11">
            Planning projects are for resource allocation only. They won't appear in the main dashboard.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1">
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Project Name *</label>
            <input
              type="text"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., Mall of Arabia Phase 2"
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Status</label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-400"
            >
              <option value="study">📚 Study Phase</option>
              <option value="tender">📋 Tender Phase</option>
              <option value="negotiation">🤝 Negotiation</option>
              <option value="confirmed">✅ Confirmed (Pending Start)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Expected Start Date</label>
            <input
              type="date"
              value={formData.expectedStart}
              onChange={(e) => setFormData({ ...formData, expectedStart: e.target.value })}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-400"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Notes</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Any additional details about this project..."
              rows={3}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-purple-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button 
              type="button" 
              onClick={onClose} 
              className="flex-1 px-4 py-3 bg-slate-100 hover:bg-slate-200 rounded-xl text-sm font-medium text-slate-700"
            >
              Cancel
            </button>
            <button 
              type="submit" 
              disabled={loading} 
              className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl text-sm font-medium disabled:opacity-50 hover:bg-purple-700"
            >
              {loading ? 'Saving...' : (project ? 'Update' : 'Add Project')}
            </button>
          </div>
        </form>
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
