import { getOpdQueue, getClinicFacility } from "@/lib/records";
import OpdDashboard from "@/components/OpdDashboard";

export default function HomePage() {
  const initialPatients = getOpdQueue();
  const facility = getClinicFacility();

  return <OpdDashboard initialPatients={initialPatients} facility={facility} />;
}
