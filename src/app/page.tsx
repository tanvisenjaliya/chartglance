import { getOpdQueue } from "@/lib/records";
import OpdDashboard from "@/components/OpdDashboard";

export default function HomePage() {
  const initialPatients = getOpdQueue();

  return <OpdDashboard initialPatients={initialPatients} />;
}
