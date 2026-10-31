/**
 * Who may see what on a run of show. Where the show IS (done, on now, next, late) is not a type
 * here any more: it is computed by services/run-of-show/showProgress.ts from the clock and the
 * producer's marks, and read through services/run-of-show/eventShow.ts.
 */
export interface RunOfShowVisibilityProfile { viewer: "agency" | "client" | "crew" | "speaker" | "sponsor" | "attendee"; canSeeInternalNotes: boolean; canSeeTechnicalCues: boolean; canSeeBackupPlan: boolean; canSeeEmergencyNotes: boolean; canControlLiveStatus: boolean; }
export const RUN_OF_SHOW_VISIBILITY: Record<RunOfShowVisibilityProfile["viewer"], RunOfShowVisibilityProfile> = {
 agency:{viewer:"agency",canSeeInternalNotes:true,canSeeTechnicalCues:true,canSeeBackupPlan:true,canSeeEmergencyNotes:true,canControlLiveStatus:true},
 client:{viewer:"client",canSeeInternalNotes:false,canSeeTechnicalCues:false,canSeeBackupPlan:false,canSeeEmergencyNotes:false,canControlLiveStatus:false},
 crew:{viewer:"crew",canSeeInternalNotes:true,canSeeTechnicalCues:true,canSeeBackupPlan:true,canSeeEmergencyNotes:true,canControlLiveStatus:false},
 speaker:{viewer:"speaker",canSeeInternalNotes:false,canSeeTechnicalCues:false,canSeeBackupPlan:false,canSeeEmergencyNotes:false,canControlLiveStatus:false},
 sponsor:{viewer:"sponsor",canSeeInternalNotes:false,canSeeTechnicalCues:false,canSeeBackupPlan:false,canSeeEmergencyNotes:false,canControlLiveStatus:false},
 attendee:{viewer:"attendee",canSeeInternalNotes:false,canSeeTechnicalCues:false,canSeeBackupPlan:false,canSeeEmergencyNotes:false,canControlLiveStatus:false},
};
