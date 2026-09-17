import type { AssetApprovalRule, EventApprovalItem } from "@/types/approvalOps";
import { listSpeakerMaterialSubmissions } from "@/services/speakers/speakerMaterialQueue";
export const assetApprovalMatrix:AssetApprovalRule[]=[{assetType:"speaker_deck",agencyApprovesTechnicalFit:true,clientApprovesBrandFit:true,submitterApprovesOwnPublicInfo:false,producerLocksFinalUse:true},{assetType:"speaker_script",agencyApprovesTechnicalFit:false,clientApprovesBrandFit:true,submitterApprovesOwnPublicInfo:true,producerLocksFinalUse:true},{assetType:"sponsor_logo",agencyApprovesTechnicalFit:true,clientApprovesBrandFit:true,submitterApprovesOwnPublicInfo:false,producerLocksFinalUse:true},{assetType:"sponsor_booth_copy",agencyApprovesTechnicalFit:false,clientApprovesBrandFit:true,submitterApprovesOwnPublicInfo:false,producerLocksFinalUse:true}];
export const mockApprovalItems:EventApprovalItem[]=[{id:"approval-speaker-script-v3",agencyId:"agency-wpp",clientId:"client-nova",eventId:"event-summit",itemType:"speaker_script",title:"Drake Mensah show-day script v3",submittedByName:"Drake Mensah",relatedSpeakerId:"speaker-drake",relatedRunOfShowSegmentId:"ros-summit-keynote",status:"needs_agency_review",dueAt:"2026-06-12T14:50:00.000Z",currentOwner:"agency",clientApprovalRequired:false,producerApprovalRequired:true,blockingScope:"run_of_show",lastComment:"Speaker wants shorter opener. Producer must approve before teleprompter goes live.",nextAction:"Approve as live version or keep v2 locked."},{id:"approval-sponsor-booth-copy",agencyId:"agency-wpp",clientId:"client-nova",eventId:"event-summit",itemType:"sponsor_booth_copy",title:"Clarity AI booth copy",submittedByName:"Riley Okafor",relatedSponsorId:"sponsor-clarity",status:"needs_client_review",dueAt:"2026-06-05T17:00:00.000Z",currentOwner:"client",clientApprovalRequired:true,producerApprovalRequired:true,blockingScope:"sponsor",lastComment:"Client needs to approve claim language before expo opens.",nextAction:"Send client reminder."}];
export function getEventApprovalQueue(eventId:string){
  const base = mockApprovalItems.filter(i=>i.eventId===eventId);
  const speakerMaterials: EventApprovalItem[] = listSpeakerMaterialSubmissions(eventId).map((item) => ({
    id: item.id,
    agencyId: "agency-wpp",
    clientId: "client-nova",
    eventId: item.eventId,
    itemType: item.kind === "deck" ? "speaker_deck" : item.kind === "supporting_document" ? "speaker_intro" : "speaker_script",
    title: item.title,
    submittedByName: item.speakerName,
    relatedSpeakerId: item.speakerId,
    status: "needs_agency_review",
    dueAt: item.createdAt,
    currentOwner: "agency",
    clientApprovalRequired: false,
    producerApprovalRequired: true,
    blockingScope: item.kind === "teleprompter_note" ? "run_of_show" : "speaker",
    lastComment: item.notes || "Speaker submitted material for producer review.",
    nextAction: "Producer reviews before updating teleprompter, deck, or show-day materials.",
  }));
  return [...speakerMaterials, ...base];
}
export function getApprovalSummary(eventId:string){const items=getEventApprovalQueue(eventId);return{eventId,total:items.length,needsAgencyReview:items.filter(i=>i.status==="needs_agency_review").length,needsClientReview:items.filter(i=>i.status==="needs_client_review").length,blocking:items.filter(i=>i.blockingScope!=="none"&&!["approved","locked","used_live"].includes(i.status)).length};}
