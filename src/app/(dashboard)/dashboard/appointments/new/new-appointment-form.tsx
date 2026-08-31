"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input, Select, Textarea } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/components/ui/toast";
import {
  createDashboardBookingAction,
  fetchDashboardSlotsAction,
} from "@/server/actions/booking";

type ClientOption = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
};

type ServiceOption = {
  id: string;
  name: string;
  durationMin: number;
  resourceIds: string[];
};

type StaffOption = {
  id: string;
  name: string;
};

export function NewAppointmentForm({
  clients,
  services,
  staff,
  defaultDay,
}: {
  clients: ClientOption[];
  services: ServiceOption[];
  staff: StaffOption[];
  defaultDay: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, startTransition] = useTransition();
  const [mode, setMode] = useState<"existing" | "new">(
    clients.length > 0 ? "existing" : "new",
  );
  const [clientId, setClientId] = useState(clients[0]?.id ?? "");
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const [resourceId, setResourceId] = useState("");
  const [day, setDay] = useState(defaultDay);
  const [startAt, setStartAt] = useState("");
  const [slots, setSlots] = useState<
    Array<{ startIso: string; label: string }>
  >([]);
  const [slotsError, setSlotsError] = useState<string | null>(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedService = services.find((s) => s.id === serviceId);
  const staffForService = useMemo(() => {
    if (!selectedService) return [];
    return staff.filter((s) => selectedService.resourceIds.includes(s.id));
  }, [selectedService, staff]);

  useEffect(() => {
    if (staffForService.length === 0) {
      setResourceId("");
      return;
    }
    if (!staffForService.some((s) => s.id === resourceId)) {
      setResourceId(staffForService[0]!.id);
    }
  }, [staffForService, resourceId]);

  useEffect(() => {
    if (!serviceId || !resourceId || !day) {
      setSlots([]);
      return;
    }
    let cancelled = false;
    setSlotsLoading(true);
    setSlotsError(null);
    setStartAt("");
    void fetchDashboardSlotsAction({ serviceId, resourceId, day }).then(
      (result) => {
        if (cancelled) return;
        setSlotsLoading(false);
        if (!result.ok) {
          setSlots([]);
          setSlotsError(result.error);
          return;
        }
        setSlots(result.data);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [serviceId, resourceId, day]);

  const selectedClient = clients.find((c) => c.id === clientId);

  return (
    <form
      className="flex max-w-md flex-col gap-3"
      aria-busy={pending}
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const formData = new FormData(form);
        if (mode === "existing") {
          formData.set("clientId", clientId);
          formData.set("name", selectedClient?.name ?? "Client");
          formData.set("email", selectedClient?.email ?? "");
          if (selectedClient?.phone) {
            formData.set("phone", selectedClient.phone);
          }
        } else {
          formData.delete("clientId");
        }
        formData.set("serviceId", serviceId);
        formData.set("resourceId", resourceId);
        formData.set("startAt", startAt);
        setError(null);
        startTransition(async () => {
          const result = await createDashboardBookingAction(formData);
          if (!result.ok) {
            setError(result.error);
            toast(result.error, "error");
            return;
          }
          toast("Appointment booked", "success");
          router.push("/dashboard/appointments");
          router.refresh();
        });
      }}
    >
      <fieldset className="flex flex-col gap-2 text-sm sm:flex-row sm:gap-4">
        <legend className="sr-only">Client</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="clientMode"
            className="h-4 w-4"
            checked={mode === "existing"}
            disabled={clients.length === 0}
            onChange={() => setMode("existing")}
          />
          Existing client
        </label>
        <label className="flex min-h-11 items-center gap-2">
          <input
            type="radio"
            name="clientMode"
            className="h-4 w-4"
            checked={mode === "new"}
            onChange={() => setMode("new")}
          />
          New client
        </label>
      </fieldset>

      {mode === "existing" ? (
        <div>
          <Label htmlFor="dash-client">Client</Label>
          <Select
            id="dash-client"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            required
          >
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.email ? ` · ${c.email}` : ""}
              </option>
            ))}
          </Select>
        </div>
      ) : (
        <>
          <div>
            <Label htmlFor="dash-name">Name</Label>
            <Input id="dash-name" name="name" required minLength={2} />
          </div>
          <div>
            <Label htmlFor="dash-email">Email</Label>
            <Input id="dash-email" name="email" type="email" />
          </div>
          <div>
            <Label htmlFor="dash-phone">Phone</Label>
            <Input id="dash-phone" name="phone" />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="marketingOptIn" />
            Marketing emails (follow-up / review / rebook)
          </label>
        </>
      )}

      <div>
        <Label htmlFor="dash-service">Service</Label>
        <Select
          id="dash-service"
          value={serviceId}
          onChange={(e) => setServiceId(e.target.value)}
          required
        >
          {services.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({s.durationMin} min)
            </option>
          ))}
        </Select>
      </div>

      <div>
        <Label htmlFor="dash-staff">Staff</Label>
        <Select
          id="dash-staff"
          value={resourceId}
          onChange={(e) => setResourceId(e.target.value)}
          required
          disabled={staffForService.length === 0}
        >
          {staffForService.length === 0 ? (
            <option value="">No staff for this service</option>
          ) : (
            staffForService.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))
          )}
        </Select>
      </div>

      <div>
        <Label htmlFor="dash-day">Date</Label>
        <Input
          id="dash-day"
          type="date"
          value={day}
          onChange={(e) => setDay(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="dash-time">Time</Label>
        {slotsLoading ? (
          <p className="text-sm text-[var(--ink-tertiary)]">Loading times…</p>
        ) : slotsError ? (
          <p className="text-sm text-[var(--danger)]" role="alert">
            {slotsError}
          </p>
        ) : slots.length === 0 ? (
          <p className="text-sm text-[var(--ink-tertiary)]">
            No open times for this staff member on that day.
          </p>
        ) : (
          <Select
            id="dash-time"
            value={startAt}
            onChange={(e) => setStartAt(e.target.value)}
            required
          >
            <option value="">Choose a time</option>
            {slots.map((slot) => (
              <option key={slot.startIso} value={slot.startIso}>
                {slot.label}
              </option>
            ))}
          </Select>
        )}
      </div>

      <div>
        <Label htmlFor="dash-notes">Notes</Label>
        <Textarea id="dash-notes" name="notes" rows={3} />
      </div>

      {error ? (
        <p className="text-sm text-[var(--danger)]" role="alert">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="min-h-12 w-full sm:w-auto"
        disabled={pending || !startAt || !resourceId}
      >
        {pending ? "Booking…" : "Book appointment"}
      </Button>
    </form>
  );
}
