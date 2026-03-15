import { DashboardLayout } from "@/components/layout/DashboardLayout";

const PlaceholderPage = ({ title }: { title: string }) => (
  <DashboardLayout>
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="text-sm text-muted-foreground mt-1">Coming soon</p>
      </div>
    </div>
  </DashboardLayout>
);

export default PlaceholderPage;
