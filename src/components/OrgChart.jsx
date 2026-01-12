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
  
  // Technical Office - VERY distinct colors: Navy → Cyan → Teal → Lime → Yellow → Orange
  { id: 'head', label: 'Head of Technical Office', level: 1, color: '#0f4c81', bgColor: '#dbeafe', department: 'Technical Office' },
  { id: 'team_leader', label: 'Team Leader', level: 2, color: '#0891b2', bgColor: '#cffafe', department: 'Technical Office' },
  { id: 'senior', label: 'Senior TOE', level: 3, color: '#0d9488', bgColor: '#ccfbf1', department: 'Technical Office' },
  { id: 'toe', label: 'Technical Office Engineer', level: 4, color: '#84cc16', bgColor: '#ecfccb', department: 'Technical Office' },
  { id: 'junior', label: 'Junior TOE', level: 5, color: '#eab308', bgColor: '#fef9c3', department: 'Technical Office' },
  { id: 'trainee', label: 'Trainee', level: 6, color: '#f97316', bgColor: '#ffedd5', department: 'Technical Office' },
  
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
