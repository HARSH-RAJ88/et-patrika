'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { UserProfile, UserRole, SupportedLanguage } from '@/types';

interface UserContextType {
  userProfile: UserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  updateRole: (role: UserRole) => Promise<void>;
  updateLanguage: (language: SupportedLanguage) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setUserProfile: (profile: UserProfile | null) => void;
  refreshProfile: () => Promise<void>;
}

const UserContext = createContext<UserContextType>({
  userProfile: null,
  isLoading: true,
  isAuthenticated: false,
  updateRole: async () => {},
  updateLanguage: async () => {},
  updateProfile: async () => {},
  setUserProfile: () => {},
  refreshProfile: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabase = createClient();

  const isGuestProfile = useCallback((profile: UserProfile | null): boolean => {
    return !!profile && profile.id === 'guest-local';
  }, []);

  const persistLocalProfile = useCallback((profile: UserProfile | null) => {
    if (!profile) return;
    try {
      localStorage.setItem('et_patrika_onboarding_profile', JSON.stringify(profile));
    } catch {
      // Ignore local storage write failures and keep in-memory profile.
    }
  }, []);

  const getLocalOnboardingProfile = useCallback((): UserProfile | null => {
    try {
      const raw = localStorage.getItem('et_patrika_onboarding_profile');
      if (!raw) return null;

      const parsed = JSON.parse(raw) as UserProfile;
      if (!parsed?.role || !parsed?.language || !parsed?.first_name) {
        return null;
      }

      return parsed;
    } catch {
      return null;
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;

      if (!user) {
        const localProfile = getLocalOnboardingProfile();
        setUserProfile(localProfile);
        setIsLoading(false);
        return;
      }

      const { data: profile, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (profile) {
        setUserProfile(profile as UserProfile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      setUserProfile(null);
    } finally {
      setIsLoading(false);
    }
  }, [getLocalOnboardingProfile, supabase]);

  useEffect(() => {
    fetchProfile();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          fetchProfile();
        } else {
          const localProfile = getLocalOnboardingProfile();
          setUserProfile(localProfile);
          setIsLoading(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [fetchProfile, getLocalOnboardingProfile, supabase.auth]);

  const updateRole = useCallback(async (role: UserRole) => {
    if (!userProfile) return;

    if (isGuestProfile(userProfile)) {
      const next = { ...userProfile, role };
      setUserProfile(next);
      persistLocalProfile(next);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      const next = { ...userProfile, role };
      setUserProfile(next);
      persistLocalProfile(next);
      return;
    }

    // Optimistic update
    const previousRole = userProfile.role;
    setUserProfile((prev) => prev ? { ...prev, role } : null);

    const { error } = await supabase
      .from('user_profiles')
      .update({ role })
      .eq('id', userProfile.id);

    if (error) {
      // Revert on error
      console.error('Failed to update role in DB:', error);
      setUserProfile((prev) => prev ? { ...prev, role: previousRole } : null);
      throw error;
    }
  }, [isGuestProfile, persistLocalProfile, userProfile, supabase]);

  const updateLanguage = useCallback(async (language: SupportedLanguage) => {
    if (!userProfile) return;

    if (isGuestProfile(userProfile)) {
      const next = { ...userProfile, language };
      setUserProfile(next);
      persistLocalProfile(next);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      const next = { ...userProfile, language };
      setUserProfile(next);
      persistLocalProfile(next);
      return;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update({ language })
      .eq('id', userProfile.id);

    if (!error) {
      setUserProfile((prev) => prev ? { ...prev, language } : null);
    }
  }, [isGuestProfile, persistLocalProfile, userProfile, supabase]);

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!userProfile) return;

    if (isGuestProfile(userProfile)) {
      const next = { ...userProfile, ...updates };
      setUserProfile(next);
      persistLocalProfile(next);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.user) {
      const next = { ...userProfile, ...updates };
      setUserProfile(next);
      persistLocalProfile(next);
      return;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(updates)
      .eq('id', userProfile.id);

    if (!error) {
      setUserProfile((prev) => prev ? { ...prev, ...updates } : null);
    }
  }, [isGuestProfile, persistLocalProfile, userProfile, supabase]);

  const refreshProfile = useCallback(async () => {
    setIsLoading(true);
    await fetchProfile();
  }, [fetchProfile]);

  return (
    <UserContext.Provider
      value={{
        userProfile,
        isLoading,
        isAuthenticated: !!userProfile,
        updateRole,
        updateLanguage,
        updateProfile,
        setUserProfile,
        refreshProfile,
      }}
    >
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
