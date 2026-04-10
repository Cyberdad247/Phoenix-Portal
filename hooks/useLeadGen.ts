'use client';

import { useState, useCallback } from 'react';

export function useLeadGen() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentSource, setCurrentSource] = useState('direct');

  const open = useCallback((source?: string) => {
    setCurrentSource(source || 'direct');
    setIsOpen(true);
  }, []);

  const close = useCallback(() => {
    setIsOpen(false);
  }, []);

  const submitLead = useCallback(async (email: string, source: string) => {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, source })
    });
    
    if (!response.ok) {
      throw new Error('Failed to submit lead');
    }
  }, []);

  return {
    isOpen,
    open,
    close,
    submitLead,
    currentSource
  };
}