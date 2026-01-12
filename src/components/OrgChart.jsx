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
  
  // Technical Office - VERY distinct: Navy → Cyan → CYAN → LIME → YELLOW → ORANGE
  { id: 'head', label: 'Head of Technical Office', level: 1, color: '#0f4c81', bgColor: '#dbeafe', department: 'Technical Office' },
  { id: 'team_leader', label: 'Team Leader', level: 2, color: '#0891b2', bgColor: '#cffafe', department: 'Technical Office' },
  { id: 'senior', label: 'Senior TOE', level: 3, color: '#06b6d4', bgColor: '#cffafe', department: 'Technical Office' },
  { id: 'toe', label: 'Technical Office Engineer', level: 4, color: '#84cc16', bgColor: '#ecfccb', department: 'Technical Office' },
  { id: 'junior', label: 'Junior TOE', level: 5, color: '#eab308', bgColor: '#fef9c3', department: 'Technical Office' },
  { id: 'trainee', label: 'Trainee', level: 6, color: '#f97316', bgColor: '#ffedd5', department: 'Technical Office' },
