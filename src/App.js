// src/App.js
import { useState, useEffect, useMemo } from "react";
import { createClient } from "@supabase/supabase-js";
import Papa from "papaparse";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  CartesianGrid, LineChart, Line, ReferenceLine, AreaChart, Area,
  ScatterChart, Scatter, ZAxis,
} from "recharts";

const supabase = createClient(
  process.env.REACT_APP_SUPABASE_URL,
  process.env.REACT_APP_SUPABASE_ANON_KEY
);

const TIERS = [
  { id:"surge", label:"Surge 24hr", tatTgt:24, avgSubtasks:8, avgMin:30 },
  { id:"three", label:"Three-day", tatTgt:72, avgSubtasks:20, avgMin:90 },
  { id:"seven", label:"Seven-day", tatTgt:168, avgSubtasks:12, avgMin:50 },
];
const ROLE_META = [
  { id:"t", label:"Transcribers", hex:"#378ADD", bg:"#eff6ff", tx:"#1e40af" },
  { id:"r", label:"Reviewers", hex:"#1D9E75", bg:"#f0fdf4", tx:"#166534" },
  { id:"er", label:"Exec reviewers", hex:"#7F77DD", bg:"#f5f3ff", tx:"#4c1d95" },
];

const waitMult = u => u<=.50?.02:u<=.70?.07:u<=.80?.15:u<=.90?.35:u<=.95?.90:3.0;
const r1 = v => Math.round(v*10)/10;
const fmt = v => r1(v).toFixed(1);
const pct = v => `${Math.round(v*100)}%`;

const werTier = (w,th) => w==null?"unknown":w<th.great?"great":w<=th.bad?"ok":"bad";
const werColor = t => t==="great"?"#16a34a":t==="ok"?"#d97706":t==="bad"?"#dc2626":"#94a3b8";
const werBg = t => t==="great"?"#dcfce7":t==="ok"?"#fef9c3":t==="bad"?"#fee2e2":"#f1f5f9";
const werMult = (w,th) => { const t=werTier(w,th); return t==="great"?1.0:t==="ok"?1.2:1.5; };
const avgWer = ws => { const f=ws.filter(x=>x.wer!=null); return f.length?f.reduce((s,x)=>s+x.wer,0)/f.length:null; };

const parseCSV = f => new Promise((res,rej) =>
  Papa.parse(f,{header:true,skipEmptyLines:true,dynamicTyping:true,complete:r=>res(r.data),error:rej}));
