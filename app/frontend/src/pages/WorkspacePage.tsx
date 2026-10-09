import { StepRail } from '@/components/interview/StepRail';
import { useWorkspace } from '@/contexts/WorkspaceContext';
import { JdStage } from '@/pages/stages/JdStage';
import { GapStage } from '@/pages/stages/GapStage';
import { InterviewStage } from '@/pages/stages/InterviewStage';
import { ReportStage } from '@/pages/stages/ReportStage';

export default function WorkspacePage() {
  const { state, patch, reachable, refreshHistory } = useWorkspace();

  return (
    <>
      <StepRail
        current={state.stage}
        reachable={reachable}
        onSelect={(stage) => patch({ stage })}
      />
      <main className="mx-auto max-w-[1280px] px-4 py-6 sm:px-6">
        {state.stage === 'jd' ? (
          <JdStage
            result={state.jd}
            jdText={state.jdText}
            resumeText={state.resumeText}
            onResult={(jd, jdText) => patch({ jd, jdText, gap: null, session: null })}
            onJdTextChange={(jdText) => patch({ jdText })}
            onResumeTextChange={(resumeText) => patch({ resumeText })}
            onNext={() => patch({ stage: 'gap' })}
          />
        ) : state.stage === 'gap' ? (
          <GapStage
            jd={state.jd}
            resumeText={state.resumeText}
            gapResult={state.gap}
            onGapResult={(gap) => patch({ gap, session: null })}
            onNext={() => patch({ stage: 'interview' })}
            onBack={() => patch({ stage: 'jd' })}
          />
        ) : state.stage === 'interview' ? (
          <InterviewStage
            jd={state.jd}
            gapResult={state.gap}
            session={state.session}
            onSession={(session) => patch({ session })}
            onFinished={() => {
              refreshHistory();
              patch({ stage: 'report' });
            }}
            onBack={() => patch({ stage: 'gap' })}
          />
        ) : (
          <ReportStage
            session={state.session}
            onSession={(session) => {
              patch({ session });
              refreshHistory();
            }}
            onBack={() => patch({ stage: 'interview' })}
          />
        )}
      </main>
    </>
  );
}
