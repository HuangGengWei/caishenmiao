import { AdminToaster } from "@/components/admin-toaster";

export default function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      {children}
      <AdminToaster />
    </>
  );
}
