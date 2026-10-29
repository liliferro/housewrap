"use client";
import { useState } from "react";
import { browserDb } from "@/lib/supabase";
import { contactSchema, type Contact, type Data } from "@/lib/model";

export function ContactFields({ contact }: { contact?: Contact }) {
  return (
    <>
      <label>
        Persona de contacto
        <input
          name="contact_name"
          required
          minLength={2}
          maxLength={100}
          defaultValue={contact?.name}
        />
      </label>
      <label>
        Correo electrónico (opcional)
        <input
          name="email"
          type="email"
          maxLength={254}
          defaultValue={contact?.email || ""}
        />
      </label>
      <label>
        Teléfono (opcional)
        <input
          name="phone"
          type="tel"
          minLength={3}
          maxLength={40}
          defaultValue={contact?.phone || ""}
        />
      </label>
    </>
  );
}

export function RelationFields({
  data,
  initialBuilder = "",
  initialContact = "",
}: {
  data: Data;
  initialBuilder?: string;
  initialContact?: string;
}) {
  const [builder, setBuilder] = useState(initialBuilder);
  const [contact, setContact] = useState(initialContact);
  const contacts = data.contacts.filter((c) => c.builder_id === builder);
  return (
    <>
      <label>
        Seleccionar builder
        <select
          name="builder_id"
          value={builder}
          onChange={(e) => {
            setBuilder(e.target.value);
            setContact("");
          }}
        >
          <option value="">+ Nuevo builder</option>
          {data.builders.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </select>
      </label>
      {!builder && (
        <label>
          Builder
          <input name="builder" required minLength={2} maxLength={100} />
        </label>
      )}
      <label>
        Seleccionar contacto
        <select
          name="contact_id"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
        >
          <option value="">+ Nueva persona de contacto</option>
          {contacts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>
      {contact ? (
        <ContactInfo contact={contacts.find((c) => c.id === contact)} />
      ) : (
        <ContactFields />
      )}
    </>
  );
}

export function ContactInfo({ contact }: { contact?: Contact }) {
  if (!contact) return <p className="muted">Contacto pendiente de asignar.</p>;
  return (
    <div className="contact-info">
      <strong>{contact.name}</strong>
      {contact.email && <a href={`mailto:${contact.email}`}>{contact.email}</a>}
      {contact.phone && (
        <a href={`tel:${contact.phone.replace(/[^+0-9]/g, "")}`}>
          {contact.phone}
        </a>
      )}
      {!contact.email && !contact.phone && (
        <span className="muted">Sin correo ni teléfono registrados.</span>
      )}
    </div>
  );
}

export async function resolveContact(
  form: FormData,
  data: Data,
  demo: boolean,
  persist: (data: Data) => void,
) {
  let next = data;
  let builder = data.builders.find((b) => b.id === form.get("builder_id"));
  const existingContact = data.contacts.find(
    (c) => c.id === form.get("contact_id"),
  );
  const values = existingContact
    ? null
    : contactSchema.parse({
        name: form.get("contact_name"),
        email: form.get("email"),
        phone: form.get("phone"),
      });
  if (!builder) {
    const name = String(form.get("builder") || "").trim();
    if (name.length < 2 || name.length > 100)
      throw new Error("Escribe el nombre del builder.");
    builder = data.builders.find(
      (b) => b.name.toLowerCase() === name.toLowerCase(),
    );
    if (!builder) {
      builder = { id: crypto.randomUUID(), name };
      if (!demo) {
        const result = await browserDb()
          .from("builders")
          .insert(builder)
          .select()
          .single();
        if (result.error)
          throw new Error(
            "No se pudo guardar el builder. Si ya existe, selecciónalo del directorio.",
          );
      }
      next = { ...next, builders: [...next.builders, builder] };
      persist(next);
    }
  }
  let contact = existingContact;
  if (contact && contact.builder_id !== builder.id)
    throw new Error("El contacto debe pertenecer al builder elegido.");
  if (!contact) {
    contact = { id: crypto.randomUUID(), builder_id: builder.id, ...values! };
    if (!demo) {
      const result = await browserDb()
        .from("contacts")
        .insert(contact)
        .select()
        .single();
      if (result.error)
        throw new Error(
          "No se pudo guardar el contacto. Revisa los datos y vuelve a intentar.",
        );
    }
    next = { ...next, contacts: [...next.contacts, contact] };
    persist(next);
  }
  return { next, builder, contact };
}

export function Directory({
  data,
  demo,
  persist,
  run,
  busy,
}: {
  data: Data;
  demo: boolean;
  persist: (d: Data) => void;
  run: (fn: () => Promise<void>) => Promise<void>;
  busy: boolean;
}) {
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  return (
    <section className="panel directory">
      <div className="section-head">
        <h2>Builders y contactos</h2>
        <button className="button primary" onClick={() => setAdding(!adding)}>
          {adding ? "Cancelar" : "Nuevo contacto"}
        </button>
      </div>
      {adding && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const f = new FormData(e.currentTarget);
            void run(async () => {
              await resolveContact(f, data, demo, persist);
              setAdding(false);
            });
          }}
        >
          <RelationFields data={data} />
          <button className="button primary" disabled={busy}>
            Guardar contacto
          </button>
        </form>
      )}
      <label>
        Buscar builder o contacto
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </label>
      {data.builders
        .filter((b) =>
          `${b.name} ${data.contacts
            .filter((c) => c.builder_id === b.id)
            .map((c) => `${c.name} ${c.email || ""} ${c.phone || ""}`)
            .join(" ")}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .map((b) => (
          <article className="builder-card" key={b.id}>
            <h3>{b.name}</h3>
            <p className="muted">
              {data.projects.filter((p) => p.builder_id === b.id).length} obras
            </p>
            <details>
              <summary>Editar nombre del builder</summary>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = String(
                    new FormData(e.currentTarget).get("name"),
                  ).trim();
                  void run(async () => {
                    if (
                      name.length < 2 ||
                      data.builders.some(
                        (x) =>
                          x.id !== b.id &&
                          x.name.toLowerCase() === name.toLowerCase(),
                      )
                    )
                      throw new Error(
                        "Revisa el nombre: ya existe otro builder con ese nombre.",
                      );
                    if (!demo) {
                      const result = await browserDb()
                        .from("builders")
                        .update({ name })
                        .eq("id", b.id)
                        .select()
                        .single();
                      if (result.error)
                        throw new Error("No se pudo actualizar el builder.");
                    }
                    persist({
                      ...data,
                      builders: data.builders.map((x) =>
                        x.id === b.id ? { ...x, name } : x,
                      ),
                    });
                  });
                }}
              >
                <label>
                  Nombre del builder
                  <input
                    name="name"
                    required
                    minLength={2}
                    maxLength={100}
                    defaultValue={b.name}
                  />
                </label>
                <button className="button outline" disabled={busy}>
                  Guardar nombre
                </button>
              </form>
            </details>
            {data.contacts
              .filter((c) => c.builder_id === b.id)
              .map((c) => (
                <div className="contact-card" key={c.id}>
                  {editing === c.id ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        const f = new FormData(e.currentTarget);
                        void run(async () => {
                          const values = contactSchema.parse({
                            name: f.get("contact_name"),
                            email: f.get("email"),
                            phone: f.get("phone"),
                          });
                          if (!demo) {
                            const result = await browserDb()
                              .from("contacts")
                              .update(values)
                              .eq("id", c.id)
                              .select()
                              .single();
                            if (result.error)
                              throw new Error(
                                "No se pudo actualizar el contacto.",
                              );
                          }
                          persist({
                            ...data,
                            contacts: data.contacts.map((x) =>
                              x.id === c.id ? { ...x, ...values } : x,
                            ),
                          });
                          setEditing(null);
                        });
                      }}
                    >
                      <ContactFields contact={c} />
                      <button className="button primary" disabled={busy}>
                        Guardar cambios
                      </button>
                      <button
                        type="button"
                        className="button outline"
                        onClick={() => setEditing(null)}
                      >
                        Cancelar
                      </button>
                    </form>
                  ) : (
                    <>
                      <ContactInfo contact={c} />
                      <button
                        className="text-link"
                        onClick={() => setEditing(c.id)}
                      >
                        Editar contacto
                      </button>
                    </>
                  )}
                </div>
              ))}
            <ul>
              {data.projects
                .filter((p) => p.builder_id === b.id)
                .map((p) => (
                  <li key={p.id}>{p.name}</li>
                ))}
            </ul>
          </article>
        ))}
      {!data.builders.length && (
        <p className="muted">
          Registra tu primer builder o créalo al agregar una obra.
        </p>
      )}
    </section>
  );
}
