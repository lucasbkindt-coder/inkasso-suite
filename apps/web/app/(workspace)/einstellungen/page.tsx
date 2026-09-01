import { DocumentSettings } from "@/components/settings/document-settings";
import { TemplateManagement } from "@/components/settings/template-management";
import { ZohoDeskSettings } from "@/components/integrations/zoho-desk-settings";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <DocumentSettings />
      <TemplateManagement />
      <ZohoDeskSettings />
    </div>
  );
}
