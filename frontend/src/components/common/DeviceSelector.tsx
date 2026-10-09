import { useMemo } from "react";
import { Cpu, FlaskConical } from "lucide-react";
import { api } from "@/services/api";
import { useAsync } from "@/hooks/useAsync";
import { useDevice } from "@/stores/useDevice";
import { useLive, type LiveReading } from "@/stores/useLive";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SIM_DEVICE } from "@/constants";
import type { Device } from "@/types";

/** Resolve which device the live pages should show, plus its device record and newest SSE reading.
 *  Auto-selection prefers a real HARDWARE device, falling back to the simulator. */
export function useSelectedDevice() {
  const { selectedId } = useDevice();
  const devices = useAsync(() => api.devices(), { pollMs: 5000 });
  const list = devices.data ?? [];
  const hardware = list.find((d) => d.source === "HARDWARE");

  const effectiveId = selectedId ?? hardware?.device_id ?? SIM_DEVICE;
  const device = list.find((d) => d.device_id === effectiveId) ?? null;

  const readings = useLive((s) => s.readings);
  const lastReading: LiveReading | undefined = useMemo(() => {
    for (let i = readings.length - 1; i >= 0; i--) {
      if (readings[i].device_id === effectiveId) return readings[i];
    }
    return undefined;
  }, [readings, effectiveId]);

  return { devices: list, effectiveId, device, lastReading, hasHardware: !!hardware };
}

export function DeviceSelector({ className }: { className?: string }) {
  const { selectedId, setSelected } = useDevice();
  const devices = useAsync(() => api.devices(), { pollMs: 5000 });
  const list = devices.data ?? [];
  const hardware = list.find((d) => d.source === "HARDWARE");
  const value = selectedId ?? "__auto__";

  return (
    <div className={className}>
      <Select value={value} onValueChange={(v) => setSelected(v === "__auto__" ? null : v)}>
        <SelectTrigger className="h-9 w-[220px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="__auto__">
            Auto ({hardware ? "hardware" : "simulation"})
          </SelectItem>
          {list.map((d) => (
            <SelectItem key={d.device_id} value={d.device_id}>
              <span className="inline-flex items-center gap-1.5">
                {iconFor(d)} {shortName(d)}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function iconFor(d: Device) {
  return d.source === "HARDWARE" ? <Cpu size={12} className="text-cyan" /> : <FlaskConical size={12} className="text-amber" />;
}

function shortName(d: Device) {
  const tag = d.source === "HARDWARE" ? "HW" : "SIM";
  return `${tag} · ${d.device_id}`;
}
