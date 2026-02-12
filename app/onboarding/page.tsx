'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function OnboardingFixPage() {
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  // State for Step 1
  const [profile, setProfile] = useState({
    full_name: '', 
    current_role: '', 
    industry: '', 
    goal_role: '',
    biggest_challenge: '', 
    time_commitment: '15min',
  });

  // State for Step 2
  const [goal, setGoal] = useState({
    goal_text: '', 
    milestone_1: '', 
    milestone_2: '', 
    milestone_3: '',
  });

  const industries = [
    'Technology', 'Finance & Banking', 'Consulting', 'Healthcare',
    'Education', 'Energy', 'Telecom', 'Government', 'NGO', 'Other',
  ];

  // ---------------------------------------------------------
  // 1. FIXED PROFILE SAVE (Uses upsert + Error Handling)
  // ---------------------------------------------------------
  const handleProfileSave = async () => {
    // 1. Check if the user is actually logged in
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      alert("Auth Error: " + authError.message);
      return;
    }

    if (!user) {
      alert("System says: You are not logged in. Please refresh or sign in again.");
      return;
    }

    // 2. Try to save using UPSERT (heals missing rows)
    const { error: dbError } = await supabase
      .from('profiles')
      .upsert({
        id: user.id,
        ...profile,
        updated_at: new Date().toISOString()
      });

    if (dbError) {
      console.error("Database Error Detail:", dbError); // Check console for full details
      alert("Database Error: " + dbError.message + " (Check console for details)");
      return;
    }

    // 3. Success
    setStep(2);
  };

  // ---------------------------------------------------------
  // 2. GOAL SAVE (Standard Insert)
  // ---------------------------------------------------------
  const handleGoalSave = async () => {
    setSaving(true);
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        alert("User not found");
        setSaving(false);
        return;
    }

    const { error } = await supabase.from('user_goals').insert({
      user_id: user.id,
      goal_text: goal.goal_text,
      timeframe: '90 days',
      milestone_1: goal.milestone_1,
      milestone_2: goal.milestone_2,
      milestone_3: goal.milestone_3,
    });

    if (error) {
        alert(`Error saving goal: ${error.message}`);
        setSaving(false);
    } else {
        router.push('/dashboard');
    }
  };

  // ── RENDER STEP 1: Profile ──
  if (step === 1) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8">
          <div className="flex-1 h-1 rounded bg-amber-500" />
          <div className="flex-1 h-1 rounded bg-gray-800" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-6">Tell us about you</h2>
        <div className="flex flex-col gap-4">
          <input 
            placeholder="Full Name" 
            value={profile.full_name}
            onChange={e => setProfile({...profile, full_name: e.target.value})}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500" 
          />
          <input 
            placeholder="Current Role" 
            value={profile.current_role}
            onChange={e => setProfile({...profile, current_role: e.target.value})}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500" 
          />
          <select 
            value={profile.industry}
            onChange={e => setProfile({...profile, industry: e.target.value})}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none"
          >
            <option value="">Select Industry</option>
            {industries.map(i => <option key={i} value={i}>{i}</option>)}
          </select>
          <input 
            placeholder="Goal Role (e.g. Engineering Manager)" 
            value={profile.goal_role}
            onChange={e => setProfile({...profile, goal_role: e.target.value})}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500" 
          />
          <textarea 
            placeholder="Biggest challenge right now" 
            value={profile.biggest_challenge}
            onChange={e => setProfile({...profile, biggest_challenge: e.target.value})}
            rows={3}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 resize-none" 
          />
          <button 
            onClick={handleProfileSave}
            disabled={!profile.full_name || !profile.current_role || !profile.industry || !profile.goal_role || saving}
            className="p-3 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
          >
            {saving ? 'Saving...' : 'Continue →'}
          </button>
        </div>
      </div>
    </div>
  );

  // ── RENDER STEP 2: Goal ──
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-6">
      <div className="w-full max-w-md">
        <div className="flex gap-2 mb-8">
          <div className="flex-1 h-1 rounded bg-amber-500" />
          <div className="flex-1 h-1 rounded bg-amber-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Your 90-Day Goal</h2>
        <p className="text-gray-400 mb-6">What will you achieve?</p>
        <div className="flex flex-col gap-4">
          <textarea 
            placeholder="e.g. Get promoted to Engineering Manager"
            value={goal.goal_text}
            onChange={e => setGoal({...goal, goal_text: e.target.value})}
            rows={2}
            className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500 resize-none" 
          />
          <p className="text-gray-500 text-sm font-medium">3 Milestones</p>
          {(['milestone_1','milestone_2','milestone_3'] as const).map((key, i) => (
            <input 
              key={key} 
              placeholder={`Milestone ${i+1}`} 
              value={goal[key]}
              onChange={e => setGoal({...goal, [key]: e.target.value})}
              className="p-3 bg-gray-900 border border-gray-700 rounded-lg text-white outline-none focus:border-amber-500" 
            />
          ))}
          <button 
            onClick={handleGoalSave}
            disabled={!goal.goal_text || saving}
            className="p-3 bg-amber-500 text-black font-semibold rounded-lg hover:bg-amber-600 transition disabled:opacity-50"
          >
            {saving ? 'Setting up...' : 'Start Coaching →'}
          </button>
        </div>
      </div>
    </div>
  );
}