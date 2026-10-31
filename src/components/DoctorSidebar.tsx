import { FacilityMetadata } from "@/lib/records";

interface DoctorSidebarProps {
  totalPatients: number;
  waitingCount?: number;
  inConsultCount?: number;
  doneCount?: number;
  facility?: FacilityMetadata;
}

export default function DoctorSidebar({
  totalPatients,
  waitingCount = 0,
  inConsultCount = 0,
  doneCount = 0,
  facility = {
    facilityName: "PHC Navli (demo)",
    district: "Anand",
    state: "Gujarat",
  },
}: DoctorSidebarProps) {
  return (
    <aside className="space-y-6">
      {/* Doctor Profile Card */}
      <div className="bg-surface rounded-2xl border border-border p-6 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-14 h-14 rounded-2xl bg-navy text-surface flex items-center justify-center font-bold text-xl shrink-0 shadow-inner">
            AS
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] font-semibold text-blue bg-panel px-2.5 py-0.5 rounded border border-border uppercase tracking-wider">
                MEDICAL OFFICER
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-navy mt-1.5 tracking-tight truncate">
              Dr. Aditi Sharma
            </h3>
            <p className="text-xs text-navy-muted">
              MBBS, DNB (Family Medicine)
            </p>
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <span className="font-mono uppercase text-[11px] tracking-wider text-slate">
                REG NO:
              </span>
              <span className="text-navy font-semibold">DEMO-0001</span>
            </div>
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 gap-2 text-xs">
          <div className="p-3 rounded-xl bg-panel border border-border">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate block">
              FACILITY
            </span>
            <span className="font-semibold text-navy mt-1 block truncate">
              {facility.facilityName}
            </span>
            <span className="text-[11px] text-navy-muted">
              {facility.district} District
            </span>
          </div>

          <div className="p-3 rounded-xl bg-panel border border-border">
            <span className="font-mono text-[11px] uppercase tracking-wider text-slate block">
              SESSION
            </span>
            <span className="font-semibold text-navy mt-1 block">
              Morning OPD
            </span>
            <span className="text-[11px] text-navy-muted">09:00 - 13:30</span>
          </div>
        </div>

        {/* OPD Queue Status */}
        <div className="mt-4 p-4 rounded-xl bg-navy text-surface">
          <span className="font-mono text-[11px] uppercase tracking-wider text-slate block">
            TODAY&apos;S ACTIVE QUEUE
          </span>
          <span className="text-xl font-bold text-surface mt-0.5 block">
            {totalPatients} Patients
          </span>

          <div className="mt-3 pt-3 border-t border-navy-muted/30 grid grid-cols-3 gap-2 text-center">
            <div>
              <span className="text-sm font-bold text-surface block">
                {waitingCount}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
                Waiting
              </span>
            </div>
            <div>
              <span className="text-sm font-bold text-amber-300 block">
                {inConsultCount}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
                In consult
              </span>
            </div>
            <div>
              <span className="text-sm font-bold text-slate block">
                {doneCount}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate">
                Done
              </span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
