import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { HybridBalanceCard } from "@/components/overview/HybridBalanceCard";
import { RecentPaymentsCard } from "@/components/overview/RecentPaymentsCard";
import { USDCSavingsCard } from "@/components/overview/USDCSavingsCard";
import { BusinessAlertsCard } from "@/components/overview/BusinessAlertsCard";
import { motion } from "framer-motion";

const Overview = () => {
  return (
    <DashboardLayout>
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
        <HybridBalanceCard />
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.1 }}>
          <RecentPaymentsCard />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.15 }}>
          <USDCSavingsCard />
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, delay: 0.2 }}>
          <BusinessAlertsCard />
        </motion.div>
      </div>
    </DashboardLayout>
  );
};

export default Overview;
