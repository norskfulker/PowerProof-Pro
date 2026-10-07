"use client";

import { ComingSoon } from "@/components/pp/coming-soon";
import { SettingsSection } from "@/components/settings/settings-section";

export default function TeamPage() {
  return (
    <SettingsSection title="Team" description="Invite people to help with orders, support and design.">
      <ComingSoon title="Team seats open soon." body="For now, only you can sign in to your stores." />
    </SettingsSection>
  );
}
