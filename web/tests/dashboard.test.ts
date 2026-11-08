import { describe,it,expect } from 'vitest';
import { dashboardStory } from '../src/lib/derive/dashboard';
import type { Replay } from '../src/lib/replay';
import local from '../fixtures/replay.local-job.json';
const r=local as Replay;
describe('plain-language dashboard story',()=>{
 it('explains genuine continuation using the recorded updates',()=>{const s=dashboardStory(r);expect(s.verified).toBe(true);expect(s.explanation).toContain(`update ${r.recovery.checkpoint!.step}`);expect(s.explanation).toContain(`update ${r.recovery.resumed!.step}`);expect(s.context).toContain('one computer')});
 it('never claims a handoff when verification is absent',()=>{const s=dashboardStory({...r,recovery:{...r.recovery,verified_resumed:false,completed_after_resume:false,rpo_steps:null,rto_ms:null}});expect(s.verified).toBe(false);expect(s.lost).toBeNull();expect(s.seconds).toBeNull();expect(s.incidentExplanation).toContain('does not yet prove');expect(s.explanation).not.toContain('finished the job')});
 it('never calls a measured trigger a practice drill',()=>{const s=dashboardStory({...r,trigger:r.trigger?{...r.trigger,source:'measured'}:null});expect(s.incidentTitle).not.toContain('practice');expect(s.incidentExplanation).not.toContain('labelled test')});
 it('does not fill missing values with zero',()=>{const s=dashboardStory(null);expect(s.lost).toBeNull();expect(s.finalStep).toBeNull();expect(s.verified).toBe(false)});
});
