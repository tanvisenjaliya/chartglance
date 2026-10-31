import fs from "fs";
import path from "path";

export interface NoteAddendum {
  id: string;
  text: string;
  doctorName: string;
  facilityName: string;
  createdAt: string; // ISO string
}

export type FollowUpPeriod = "none" | "1 week" | "2 weeks" | "1 month" | "3 months";

export interface ConsultationNote {
  id: string;
  patientId: string;
  visitId?: string;
  date: string;       // Formatted date string, e.g. "31 Oct 2026"
  time: string;       // Formatted time, e.g. "15:45"
  doctorName: string; // e.g. "Dr. Aditi Sharma"
  facilityName: string; // e.g. "PHC Navli (demo)"
  noteText: string;
  followUp: FollowUpPeriod;
  addendums: NoteAddendum[];
  createdAt: string;  // ISO string
}

export interface DraftNote {
  patientId: string;
  noteText: string;
  followUp: FollowUpPeriod;
  updatedAt: string;
}

interface NotesStoreSchema {
  notes: ConsultationNote[];
  drafts: Record<string, DraftNote>; // key is patientId
}

const RUNTIME_DIR = path.join(process.cwd(), "data", "runtime");
const NOTES_FILE = path.join(RUNTIME_DIR, "notes.json");

function ensureNotesFile(): NotesStoreSchema {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
  if (!fs.existsSync(NOTES_FILE)) {
    const initial: NotesStoreSchema = { notes: [], drafts: {} };
    fs.writeFileSync(NOTES_FILE, JSON.stringify(initial, null, 2), "utf-8");
    return initial;
  }
  try {
    const raw = fs.readFileSync(NOTES_FILE, "utf-8");
    return JSON.parse(raw) as NotesStoreSchema;
  } catch {
    const fallback: NotesStoreSchema = { notes: [], drafts: {} };
    fs.writeFileSync(NOTES_FILE, JSON.stringify(fallback, null, 2), "utf-8");
    return fallback;
  }
}

function persistStore(data: NotesStoreSchema): void {
  if (!fs.existsSync(RUNTIME_DIR)) {
    fs.mkdirSync(RUNTIME_DIR, { recursive: true });
  }
  fs.writeFileSync(NOTES_FILE, JSON.stringify(data, null, 2), "utf-8");
}

/**
 * notesStore — Unified store for consultation notes & drafts.
 * Backed by /data/runtime/notes.json. Cleanly modular to swap anytime.
 */
export const notesStore = {
  /**
   * Retrieves all completed notes for a patient, ordered newest first.
   */
  getNotes(patientId: string): ConsultationNote[] {
    const store = ensureNotesFile();
    return store.notes
      .filter((n) => n.patientId === patientId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  /**
   * Saves a finalized, read-only consultation note.
   */
  saveNote(data: {
    patientId: string;
    visitId?: string;
    date: string;
    time: string;
    doctorName: string;
    facilityName: string;
    noteText: string;
    followUp: FollowUpPeriod;
  }): ConsultationNote {
    const store = ensureNotesFile();
    const now = new Date();
    const newNote: ConsultationNote = {
      id: `note-${data.patientId}-${now.getTime()}`,
      patientId: data.patientId,
      visitId: data.visitId,
      date: data.date,
      time: data.time,
      doctorName: data.doctorName,
      facilityName: data.facilityName,
      noteText: data.noteText,
      followUp: data.followUp,
      addendums: [],
      createdAt: now.toISOString(),
    };

    store.notes.unshift(newNote);
    // Clear draft if it exists
    delete store.drafts[data.patientId];
    persistStore(store);

    return newNote;
  },

  /**
   * Appends a dated addendum without modifying original note text.
   */
  addAddendum(
    noteId: string,
    addendumData: {
      text: string;
      doctorName: string;
      facilityName: string;
    }
  ): ConsultationNote | null {
    const store = ensureNotesFile();
    const noteIndex = store.notes.findIndex((n) => n.id === noteId);
    if (noteIndex === -1) return null;

    const now = new Date();
    const newAddendum: NoteAddendum = {
      id: `addendum-${noteId}-${now.getTime()}`,
      text: addendumData.text,
      doctorName: addendumData.doctorName,
      facilityName: addendumData.facilityName,
      createdAt: now.toISOString(),
    };

    store.notes[noteIndex].addendums.push(newAddendum);
    persistStore(store);

    return store.notes[noteIndex];
  },

  /**
   * Gets the autosaved draft for a patient, if any.
   */
  getDraft(patientId: string): DraftNote | null {
    const store = ensureNotesFile();
    return store.drafts[patientId] || null;
  },

  /**
   * Autosaves a draft note for a patient.
   */
  saveDraft(draft: {
    patientId: string;
    noteText: string;
    followUp: FollowUpPeriod;
  }): void {
    const store = ensureNotesFile();
    store.drafts[draft.patientId] = {
      ...draft,
      updatedAt: new Date().toISOString(),
    };
    persistStore(store);
  },

  /**
   * Clears a patient's draft.
   */
  clearDraft(patientId: string): void {
    const store = ensureNotesFile();
    if (store.drafts[patientId]) {
      delete store.drafts[patientId];
      persistStore(store);
    }
  },
};

