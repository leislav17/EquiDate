import React, { useState, useEffect, useCallback } from 'react';
import { useEquestrian } from '../../context/EquestrianContext';
import { AdminCompetitionList } from './AdminCompetitionList';
import { AdminEventEditor } from './AdminEventEditor';

export const AdminDashboard: React.FC = () => {
  const { isLoading } = useEquestrian();

  // Helper to read eventId from URL query (?event=xyz or ?event=new) or hash
  const getEventIdFromUrl = useCallback((): string | null => {
    if (typeof window === 'undefined') return null;
    const searchParams = new URLSearchParams(window.location.search);
    const paramEvent = searchParams.get('event');
    if (paramEvent) return paramEvent;

    // Check hash for fallback e.g. #/admin/event/123 or #admin?event=123
    const hash = window.location.hash;
    if (hash.includes('event=')) {
      const match = hash.match(/event=([^&]+)/);
      if (match) return decodeURIComponent(match[1]);
    }
    return null;
  }, []);

  const [currentEventId, setCurrentEventId] = useState<string | null>(getEventIdFromUrl);

  // Synchronize on browser history navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const urlId = getEventIdFromUrl();
      setCurrentEventId(urlId);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [getEventIdFromUrl]);

  const handleSelectEvent = (eventId: string) => {
    setCurrentEventId(eventId);
    if (typeof window !== 'undefined') {
      window.history.pushState({ event: eventId }, '', `/admin?event=${encodeURIComponent(eventId)}`);
    }
  };

  const handleNewEvent = () => {
    setCurrentEventId('new');
    if (typeof window !== 'undefined') {
      window.history.pushState({ event: 'new' }, '', '/admin?event=new');
    }
  };

  const handleBackToList = () => {
    setCurrentEventId(null);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/admin');
    }
  };

  if (currentEventId) {
    return (
      <AdminEventEditor
        eventId={currentEventId}
        onBack={handleBackToList}
        onSelectEvent={(newId) => {
          setCurrentEventId(newId);
          if (typeof window !== 'undefined') {
            window.history.replaceState({ event: newId }, '', `/admin?event=${encodeURIComponent(newId)}`);
          }
        }}
      />
    );
  }

  return (
    <AdminCompetitionList
      onSelectEvent={handleSelectEvent}
      onNewEvent={handleNewEvent}
    />
  );
};
