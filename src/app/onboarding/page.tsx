'use client';

import React, { useState, useCallback } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useUser } from '@/contexts/UserContext';
import type { UserRole, SupportedLanguage } from '@/types';

/* ─── Constants ───────────────────────────────────────────────── */

const ROLES: { id: UserRole; emoji: string; label: string; tagline: string }[] = [
  { id: 'student', emoji: '🎓', label: 'Student', tagline: 'Decoding news for my future' },
  { id: 'investor', emoji: '📈', label: 'Investor', tagline: 'Tracking markets and opportunities' },
  { id: 'founder', emoji: '🚀', label: 'Founder', tagline: 'Building what\'s next' },
  { id: 'citizen', emoji: '🌍', label: 'Citizen', tagline: 'Understanding the economy around me' },
];

const INTERESTS = [
  'Startups', 'Policy', 'Markets', 'Tech', 'Global', 'Finance',
  'Education', 'Health', 'Science', 'Entertainment',
];

const LANGUAGES: { code: SupportedLanguage; label: string; native: string }[] = [
  { code: 'en', label: 'English', native: 'English' },
  { code: 'hi', label: 'Hindi', native: 'हिंदी' },
  { code: 'ta', label: 'Tamil', native: 'தமிழ்' },
  { code: 'bn', label: 'Bengali', native: 'বাংলা' },
  { code: 'te', label: 'Telugu', native: 'తెలుగు' },
];

const ROLE_COLORS: Record<UserRole, string> = {
  student: '#2563EB',
  investor: '#059669',
  founder: '#7C3AED',
  citizen: '#D97706',
};

const ROLE_BG: Record<UserRole, string> = {
  student: '#EFF6FF',
  investor: '#ECFDF5',
  founder: '#F5F3FF',
  citizen: '#FFFBEB',
};

/* ─── Animated SVG Background ────────────────────────────────── */

function NetworkPattern() {
  return (
    <svg
      className="network-svg"
      viewBox="0 0 600 800"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <radialGradient id="glow1" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(232,19,43,0.3)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id="glow2" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(122,10,20,0.2)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>

      {/* Ambient glow orbs */}
      <circle cx="150" cy="200" r="120" fill="url(#glow1)" className="orb-1" />
      <circle cx="400" cy="500" r="160" fill="url(#glow2)" className="orb-2" />
      <circle cx="300" cy="100" r="80" fill="url(#glow1)" className="orb-3" />

      {/* Network lines */}
      {[
        { x1: 80, y1: 150, x2: 250, y2: 280 },
        { x1: 250, y1: 280, x2: 450, y2: 200 },
        { x1: 450, y1: 200, x2: 520, y2: 400 },
        { x1: 520, y1: 400, x2: 350, y2: 550 },
        { x1: 350, y1: 550, x2: 150, y2: 480 },
        { x1: 150, y1: 480, x2: 80, y2: 150 },
        { x1: 250, y1: 280, x2: 350, y2: 550 },
        { x1: 450, y1: 200, x2: 150, y2: 480 },
        { x1: 200, y1: 650, x2: 400, y2: 700 },
        { x1: 100, y1: 350, x2: 300, y2: 400 },
        { x1: 300, y1: 400, x2: 500, y2: 350 },
      ].map((line, i) => (
        <line
          key={i}
          x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2}
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
          className={`network-line line-${i}`}
        />
      ))}

      {/* Network nodes */}
      {[
        { cx: 80, cy: 150 }, { cx: 250, cy: 280 }, { cx: 450, cy: 200 },
        { cx: 520, cy: 400 }, { cx: 350, cy: 550 }, { cx: 150, cy: 480 },
        { cx: 200, cy: 650 }, { cx: 400, cy: 700 }, { cx: 100, cy: 350 },
        { cx: 300, cy: 400 }, { cx: 500, cy: 350 },
      ].map((node, i) => (
        <g key={i}>
          <circle cx={node.cx} cy={node.cy} r="16" fill="rgba(232,19,43,0.06)" className={`node-pulse node-${i}`} />
          <circle cx={node.cx} cy={node.cy} r="4" fill="rgba(255,255,255,0.5)" className={`node-dot node-${i}`} />
        </g>
      ))}
    </svg>
  );
}

/* ─── Step Indicator ──────────────────────────────────────────── */

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '2rem' }}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          style={{
            width: i === current ? '32px' : '8px',
            height: '8px',
            borderRadius: '4px',
            background: i === current ? 'var(--color-brand)' : i < current ? 'var(--color-brand-light)' : 'var(--color-border)',
            transition: 'all 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        />
      ))}
    </div>
  );
}

/* ─── Main Onboarding Page ────────────────────────────────────── */

export default function OnboardingPage() {
  const router = useRouter();
  const { setUserProfile } = useUser();
  const supabase = createClient();

  const [step, setStep] = useState(0);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [selectedLanguage, setSelectedLanguage] = useState<SupportedLanguage>('en');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [firstName, setFirstName] = useState('');

  const canProceed = useCallback(() => {
    if (step === 0) return !!selectedRole;
    if (step === 1) return selectedInterests.length >= 2;
    if (step === 2) return !!selectedLanguage && firstName.trim().length > 0;
    return false;
  }, [step, selectedRole, selectedInterests, selectedLanguage, firstName]);

  const handleNext = () => {
    if (step < 2) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((prev) =>
      prev.includes(interest)
        ? prev.filter((i) => i !== interest)
        : [...prev, interest]
    );
  };

  const handleSubmit = async () => {
    if (!selectedRole || !canProceed()) return;
    setIsSubmitting(true);
    setErrorMsg('');

    try {
      const { data: { user } } = await supabase.auth.getUser();

      const localProfile = {
        id: user?.id || 'guest-local',
        role: selectedRole,
        interests: selectedInterests,
        language: selectedLanguage,
        first_name: firstName.trim(),
        last_name: '',
      };

      if (!user) {
        localStorage.setItem('et_patrika_onboarding_profile', JSON.stringify(localProfile));
        document.cookie = 'et_patrika_onboarding_complete=true; path=/; max-age=2592000';
        setUserProfile(localProfile);
        router.push('/dashboard');
        return;
      }

      // Insert into Supabase
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: user.id,
          role: selectedRole,
          interests: selectedInterests,
          language: selectedLanguage,
          first_name: firstName.trim(),
          last_name: '',
        })
        .select()
        .single();

      if (error) throw error;

      document.cookie = 'et_patrika_onboarding_complete=true; path=/; max-age=2592000';
      setUserProfile(data);
      router.push('/dashboard');
    } catch (error) {
      console.error('Onboarding error:', error);
      setErrorMsg('Failed to save profile. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <style>{`
        .onboarding-container {
          display: flex;
          min-height: 100vh;
          width: 100%;
        }

        /* ─── Left Panel (Brand Visual) ─── */
        .onboarding-left {
          position: relative;
          flex: 0 0 45%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          background: linear-gradient(160deg, #0F0F0F 0%, #1A0508 40%, #2D0A10 100%);
          overflow: hidden;
          padding: 3rem;
        }

        .network-svg {
          position: absolute;
          inset: 0;
          width: 100%;
          height: 100%;
        }

        .orb-1 { animation: float 8s ease-in-out infinite; }
        .orb-2 { animation: float 10s ease-in-out infinite 2s; }
        .orb-3 { animation: float 7s ease-in-out infinite 4s; }

        .node-pulse {
          animation: pulse-glow 3s ease-in-out infinite;
        }
        .node-0 { animation-delay: 0s; }
        .node-1 { animation-delay: 0.3s; }
        .node-2 { animation-delay: 0.6s; }
        .node-3 { animation-delay: 0.9s; }
        .node-4 { animation-delay: 1.2s; }
        .node-5 { animation-delay: 1.5s; }
        .node-6 { animation-delay: 1.8s; }
        .node-7 { animation-delay: 2.1s; }
        .node-8 { animation-delay: 2.4s; }
        .node-9 { animation-delay: 2.7s; }
        .node-10 { animation-delay: 3.0s; }

        .network-line {
          stroke-dasharray: 4 8;
          animation: dash-flow 4s linear infinite;
        }
        .line-1 { animation-delay: 0.5s; }
        .line-2 { animation-delay: 1s; }
        .line-3 { animation-delay: 1.5s; }
        .line-4 { animation-delay: 2s; }

        @keyframes dash-flow {
          from { stroke-dashoffset: 24; }
          to { stroke-dashoffset: 0; }
        }

        .brand-content {
          position: relative;
          z-index: 10;
          text-align: center;
        }

        .brand-logo {
          width: 120px;
          height: auto;
          margin-bottom: 1.5rem;
          filter: drop-shadow(0 4px 24px rgba(232,19,43,0.3));
        }

        .brand-tagline {
          font-family: var(--font-headline);
          font-size: 2rem;
          color: white;
          line-height: 1.3;
          max-width: 320px;
          margin: 0 auto;
        }

        .brand-tagline span {
          background: linear-gradient(135deg, #E8132B, #FF6B6B);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        .brand-subtitle {
          font-family: var(--font-body);
          font-size: 0.9rem;
          color: rgba(255,255,255,0.45);
          margin-top: 1rem;
          letter-spacing: 0.04em;
        }

        /* ─── Right Panel (Form) ─── */
        .onboarding-right {
          flex: 1;
          display: flex;
          flex-direction: column;
          justify-content: center;
          padding: 3rem 4rem;
          background: var(--color-bg);
          overflow-y: auto;
        }

        .form-container {
          max-width: 520px;
          width: 100%;
          margin: 0 auto;
        }

        .step-title {
          font-family: var(--font-headline);
          font-size: 1.75rem;
          color: var(--color-ink);
          margin-bottom: 0.5rem;
        }

        .step-desc {
          font-size: 0.95rem;
          color: var(--color-ink-muted);
          margin-bottom: 2rem;
          line-height: 1.5;
        }

        /* ─── Role Cards ─── */
        .role-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
          margin-bottom: 2rem;
        }

        .role-card {
          position: relative;
          display: flex;
          flex-direction: column;
          padding: 1.5rem;
          border: 2px solid var(--color-border);
          border-radius: var(--radius-lg);
          background: var(--color-surface);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          overflow: hidden;
        }

        .role-card::before {
          content: '';
          position: absolute;
          top: 0;
          left: 0;
          right: 0;
          height: 3px;
          background: transparent;
          transition: background 0.3s ease;
        }

        .role-card:hover {
          border-color: var(--color-ink-subtle);
          transform: translateY(-2px);
          box-shadow: var(--shadow-md);
        }

        .role-card-selected {
          transform: translateY(-2px);
          box-shadow: var(--shadow-lg);
        }

        .role-card-selected::before {
          height: 4px;
        }

        .role-emoji {
          font-size: 2rem;
          margin-bottom: 0.75rem;
        }

        .role-label {
          font-family: var(--font-body);
          font-weight: 700;
          font-size: 1.05rem;
          color: var(--color-ink);
          margin-bottom: 0.25rem;
        }

        .role-tagline {
          font-size: 0.82rem;
          color: var(--color-ink-muted);
          line-height: 1.4;
        }

        .role-check {
          position: absolute;
          top: 1rem;
          right: 1rem;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 0.75rem;
          color: white;
          opacity: 0;
          transform: scale(0.5);
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }

        .role-card-selected .role-check {
          opacity: 1;
          transform: scale(1);
        }

        /* ─── Interest Pills ─── */
        .interests-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.625rem;
          margin-bottom: 2rem;
        }

        .interest-pill {
          padding: 0.5rem 1.125rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-full);
          background: var(--color-surface);
          color: var(--color-ink-secondary);
          font-size: 0.88rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
          user-select: none;
        }

        .interest-pill:hover {
          border-color: var(--color-brand);
          color: var(--color-brand);
        }

        .interest-pill-active {
          background: var(--color-brand);
          border-color: var(--color-brand);
          color: white;
        }

        .interest-pill-active:hover {
          background: var(--color-brand-dark);
          border-color: var(--color-brand-dark);
          color: white;
        }

        .interest-counter {
          font-size: 0.82rem;
          color: var(--color-ink-muted);
          margin-bottom: 1rem;
        }

        /* ─── Language Selection ─── */
        .lang-grid {
          display: flex;
          flex-wrap: wrap;
          gap: 0.625rem;
          margin-bottom: 2rem;
        }

        .lang-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 1rem 1.25rem;
          border: 2px solid var(--color-border);
          border-radius: var(--radius-md);
          background: var(--color-surface);
          cursor: pointer;
          transition: all 0.2s ease;
          min-width: 90px;
        }

        .lang-card:hover {
          border-color: var(--color-brand);
        }

        .lang-card-active {
          border-color: var(--color-brand);
          background: var(--color-brand-light);
        }

        .lang-native {
          font-size: 1.1rem;
          font-weight: 600;
          color: var(--color-ink);
          margin-bottom: 0.125rem;
        }

        .lang-label {
          font-size: 0.75rem;
          color: var(--color-ink-muted);
        }

        /* ─── Name Input ─── */
        .name-input {
          width: 100%;
          padding: 0.875rem 1rem;
          border: 1.5px solid var(--color-border);
          border-radius: var(--radius-md);
          font-family: var(--font-body);
          font-size: 0.95rem;
          color: var(--color-ink);
          background: var(--color-surface);
          transition: border-color 0.2s ease;
          outline: none;
          margin-bottom: 1.5rem;
        }

        .name-input:focus {
          border-color: var(--color-brand);
          box-shadow: 0 0 0 3px var(--color-brand-glow);
        }

        .name-input::placeholder {
          color: var(--color-ink-subtle);
        }

        /* ─── Navigation ─── */
        .nav-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 1.5rem;
        }

        .back-btn {
          padding: 0.625rem 1.25rem;
          background: transparent;
          border: 1px solid var(--color-border);
          border-radius: var(--radius-full);
          color: var(--color-ink-muted);
          font-size: 0.9rem;
          cursor: pointer;
          transition: all 0.2s ease;
          font-family: var(--font-body);
        }

        .back-btn:hover {
          border-color: var(--color-ink-subtle);
          color: var(--color-ink);
        }

        .next-btn {
          padding: 0.75rem 2rem;
          background: var(--gradient-brand);
          color: white;
          border: none;
          border-radius: var(--radius-full);
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          box-shadow: var(--shadow-brand);
          font-family: var(--font-body);
        }

        .next-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 6px 24px rgba(232, 19, 43, 0.3);
        }

        .next-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
          box-shadow: none;
        }

        /* ─── Step Transitions ─── */
        .step-content {
          animation: fadeIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) both;
        }

        /* ─── Responsive ─── */
        @media (max-width: 900px) {
          .onboarding-container {
            flex-direction: column;
          }
          .onboarding-left {
            display: none;
          }
          .brand-tagline {
            font-size: 1.5rem;
          }
          .onboarding-right {
            padding: 2rem 1.5rem;
          }
          .role-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="onboarding-container">
        {/* ─── Left Panel ───────────────────────────────────── */}
        <div className="onboarding-left">
          <NetworkPattern />
          <div className="brand-content">
            <Image
              src="/logo.png"
              alt="ET Patrika"
              width={120}
              height={120}
              className="brand-logo"
              priority
            />
            <h1 className="brand-tagline">
              News intelligence, <span>built for who you are.</span>
            </h1>
            <p className="brand-subtitle">
              ONE STORY · FOUR PERSPECTIVES · SYNTHESIZED
            </p>
          </div>
        </div>

        {/* ─── Right Panel ──────────────────────────────────── */}
        <div className="onboarding-right">
          <div className="form-container">
            <StepIndicator current={step} total={3} />

            {/* ── Step 0: Role Selection ─── */}
            {step === 0 && (
              <div className="step-content" key="step-0">
                <h2 className="step-title">I am a...</h2>
                <p className="step-desc">
                  Choose your lens. We&apos;ll tailor every briefing to your perspective.
                </p>

                <div className="role-grid">
                  {ROLES.map((role) => {
                    const isSelected = selectedRole === role.id;
                    return (
                      <div
                        key={role.id}
                        className={`role-card ${isSelected ? 'role-card-selected' : ''}`}
                        onClick={() => setSelectedRole(role.id)}
                        style={{
                          borderColor: isSelected ? ROLE_COLORS[role.id] : undefined,
                          background: isSelected ? ROLE_BG[role.id] : undefined,
                        }}
                      >
                        <div
                          className="role-check"
                          style={{ background: ROLE_COLORS[role.id] }}
                        >
                          ✓
                        </div>
                        <span className="role-emoji">{role.emoji}</span>
                        <span className="role-label">{role.label}</span>
                        <span className="role-tagline">{role.tagline}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="nav-row">
                  <div />
                  <button
                    className="next-btn"
                    disabled={!canProceed()}
                    onClick={handleNext}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 1: Interests ─── */}
            {step === 1 && (
              <div className="step-content" key="step-1">
                <h2 className="step-title">I care about...</h2>
                <p className="step-desc">
                  Select topics that matter to you. We&apos;ll prioritize these in your feed.
                </p>

                <p className="interest-counter">
                  {selectedInterests.length} selected · minimum 2 required
                </p>

                <div className="interests-grid">
                  {INTERESTS.map((interest) => {
                    const isActive = selectedInterests.includes(interest);
                    return (
                      <button
                        key={interest}
                        className={`interest-pill ${isActive ? 'interest-pill-active' : ''}`}
                        onClick={() => toggleInterest(interest)}
                      >
                        {interest}
                      </button>
                    );
                  })}
                </div>

                <div className="nav-row">
                  <button className="back-btn" onClick={handleBack}>
                    ← Back
                  </button>
                  <button
                    className="next-btn"
                    disabled={!canProceed()}
                    onClick={handleNext}
                  >
                    Continue →
                  </button>
                </div>
              </div>
            )}

            {/* ── Step 2: Language + Name ─── */}
            {step === 2 && (
              <div className="step-content" key="step-2">
                <h2 className="step-title">Almost there</h2>
                <p className="step-desc">
                  Choose your preferred language and let us know your name.
                </p>

                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-ink-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                  Preferred language
                </label>
                <div className="lang-grid">
                  {LANGUAGES.map((lang) => {
                    const isActive = selectedLanguage === lang.code;
                    return (
                      <div
                        key={lang.code}
                        className={`lang-card ${isActive ? 'lang-card-active' : ''}`}
                        onClick={() => setSelectedLanguage(lang.code)}
                      >
                        <span className="lang-native">{lang.native}</span>
                        <span className="lang-label">{lang.label}</span>
                      </div>
                    );
                  })}
                </div>

                <label style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--color-ink-secondary)', marginBottom: '0.5rem', display: 'block' }}>
                  Your first name
                </label>
                <input
                  type="text"
                  className="name-input"
                  placeholder="Enter your name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                />

                <div className="nav-row">
                  <button className="back-btn" onClick={handleBack}>
                    ← Back
                  </button>
                  <button
                    className="next-btn"
                    disabled={!canProceed() || isSubmitting}
                    onClick={handleSubmit}
                  >
                    {isSubmitting ? 'Setting up...' : 'Enter ET Patrika →'}
                  </button>
                </div>
                {errorMsg && <div style={{ color: '#E8132B', marginTop: '1rem', fontSize: '0.85rem', textAlign: 'center' }}>{errorMsg}</div>}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
