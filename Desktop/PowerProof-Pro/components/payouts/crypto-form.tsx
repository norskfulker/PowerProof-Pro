"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormError } from "@/components/auth/auth-card";
import { addCryptoWallet } from "@/lib/api";
import { CRYPTO_ASSETS, CRYPTO_NETWORKS, isWalletAddress, networksFor, type CryptoAsset, type CryptoNetwork } from "@/lib/india";
import type { PayoutMethod } from "@/lib/types";

interface Values {
  asset: CryptoAsset;
  network: CryptoNetwork;
  address: string;
  confirm: string;
}

/** Add a wallet to be paid in USDT or other crypto. The address is checked for its network and typed twice. */
export function CryptoForm({ onSaved }: { onSaved: (m: PayoutMethod) => void }) {
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  const form = useForm<Values>({ defaultValues: { asset: "USDT", network: "TRC20", address: "", confirm: "" }, mode: "onTouched" });
  const asset = useWatch({ control: form.control, name: "asset" });
  const picked = useWatch({ control: form.control, name: "network" });
  const address = useWatch({ control: form.control, name: "address" });
  const confirm = useWatch({ control: form.control, name: "confirm" });
  const networks = networksFor(asset);
  const network: CryptoNetwork = networks.includes(picked) ? picked : networks[0];
  const addressError = address && !isWalletAddress(network, address) ? `That doesn't look like a ${CRYPTO_NETWORKS[network].label} address (${CRYPTO_NETWORKS[network].example}).` : undefined;
  const confirmError = confirm && confirm.trim() !== address.trim() ? "The two addresses don't match." : undefined;
  const ready = !!address && !addressError && confirm.trim() === address.trim();

  async function save() {
    setError(undefined);
    setBusy(true);
    try {
      onSaved(await addCryptoWallet({ asset, network, address: address.trim() }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (ready) void save();
      }}
    >
      <FormError message={error} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cw-asset">What you get paid in</Label>
          <Select
            value={asset}
            onValueChange={(v) => {
              const a = v as CryptoAsset;
              form.setValue("asset", a);
              if (!networksFor(a).includes(network)) form.setValue("network", networksFor(a)[0]);
            }}
          >
            <SelectTrigger id="cw-asset" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{CRYPTO_ASSETS.map((a) => <SelectItem key={a} value={a}>{a}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="cw-network">Network</Label>
          <Select value={network} onValueChange={(v) => { if (v in CRYPTO_NETWORKS) form.setValue("network", v as CryptoNetwork); }}>
            <SelectTrigger id="cw-network" className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>{networks.map((n) => <SelectItem key={n} value={n}>{CRYPTO_NETWORKS[n].label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cw-address">Wallet address</Label>
        <Input id="cw-address" className="font-mono" autoComplete="off" spellCheck={false} aria-invalid={!!addressError || undefined} {...form.register("address")} />
        {addressError && <p role="alert" className="text-sm font-medium text-danger">{addressError}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="cw-confirm">Type it again</Label>
        <Input id="cw-confirm" className="font-mono" autoComplete="off" spellCheck={false} onPaste={(e) => e.preventDefault()} aria-invalid={!!confirmError || undefined} {...form.register("confirm")} />
        {confirmError && <p role="alert" className="text-sm font-medium text-danger">{confirmError}</p>}
      </div>
      <p className="flex items-start gap-2 text-sm text-muted-foreground">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
        Crypto transfers can&apos;t be undone. Make sure the network matches your wallet: {asset} sent on the wrong network is lost.
      </p>
      <Button type="submit" disabled={!ready || busy} className="self-start">Save wallet</Button>
    </form>
  );
}
