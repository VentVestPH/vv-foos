import { afterAll, describe, expect, it } from 'vitest';
import { clientAs } from '../env';

const RUN = `${process.pid}-${Math.random().toString(36).slice(2, 8)}`;
const ticketIds: string[] = [];

async function newTicket(subject: string): Promise<string> {
  const admin = await clientAs('admin');
  const { data, error } = await admin.from('tickets').insert({ subject }).select('id').single();
  expect(error).toBeNull();
  ticketIds.push(data!.id);
  return data!.id;
}

afterAll(async () => {
  const admin = await clientAs('admin');
  if (ticketIds.length) await admin.from('tickets').delete().in('id', ticketIds);
});

describe('ticket activity triggers', () => {
  it('deletes a ticket that has links, and records the unlink on the ticket that survives', async () => {
    const admin = await clientAs('admin');
    const { data: me } = await admin.auth.getUser();
    const doomed = await newTicket(`QA doomed ${RUN}`);
    const kept = await newTicket(`QA kept ${RUN}`);
    const { error: linkError } = await admin.from('ticket_links').insert({
      ticket_id: kept,
      linked_ticket_id: doomed,
      relationship: 'blocks',
      created_by: me.user!.id,
    });
    expect(linkError).toBeNull();
    const { error: externalError } = await admin.from('ticket_external_links').insert({
      ticket_id: doomed,
      url: 'https://example.com/qa',
      label: 'QA',
      created_by: me.user!.id,
    });
    expect(externalError).toBeNull();

    const { data: deleted, error: deleteError } = await admin.from('tickets').delete().eq('id', doomed).select('id');
    expect(deleteError).toBeNull();
    expect(deleted).toHaveLength(1);

    const { data: keptHistory } = await admin
      .from('ticket_history')
      .select('event_type')
      .eq('ticket_id', kept)
      .eq('event_type', 'ticket_unlinked');
    expect(keptHistory).toHaveLength(1);
  });

  it('refuses a blocking cycle', async () => {
    const admin = await clientAs('admin');
    const { data: me } = await admin.auth.getUser();
    const a = await newTicket(`QA cycle a ${RUN}`);
    const b = await newTicket(`QA cycle b ${RUN}`);
    const created_by = me.user!.id;
    expect((await admin.from('ticket_links').insert({ ticket_id: a, linked_ticket_id: b, relationship: 'blocks', created_by })).error).toBeNull();
    const { error } = await admin.from('ticket_links').insert({ ticket_id: b, linked_ticket_id: a, relationship: 'blocks', created_by });
    expect(error?.message).toMatch(/blocking cycle/);
  });

  it('deleting a comment removes its content from the row and from history, at server time', async () => {
    const bd = await clientAs('bd');
    const { data: me } = await bd.auth.getUser();
    const ticket = await newTicket(`QA comment ${RUN}`);
    const { data: comment, error } = await bd
      .from('ticket_comments')
      .insert({ ticket_id: ticket, author_id: me.user!.id, body: '<p>secret first draft</p>' })
      .select('id')
      .single();
    expect(error).toBeNull();
    expect((await bd.from('ticket_comments').update({ body: '<p>secret second draft</p>' }).eq('id', comment!.id)).error).toBeNull();

    const backdated = '2000-01-01T00:00:00Z';
    const { error: deleteError } = await bd
      .from('ticket_comments')
      .update({ deleted_at: backdated })
      .eq('id', comment!.id);
    expect(deleteError).toBeNull();

    const { data: row } = await bd.from('ticket_comments').select('body, deleted_at, deleted_by').eq('id', comment!.id).single();
    expect(row!.body).toBe('');
    expect(row!.deleted_by).toBe(me.user!.id);
    expect(new Date(row!.deleted_at!).getFullYear(), 'the client cannot backdate a delete').toBeGreaterThan(2000);

    const { data: history } = await bd.from('ticket_history').select('event_type, changes').eq('comment_id', comment!.id);
    expect(JSON.stringify(history)).not.toContain('secret');
    expect(history!.map((entry) => entry.event_type).sort()).toEqual(['comment_added', 'comment_deleted', 'comment_edited']);
  });

  it('lets only the author edit a comment, and not after it is deleted', async () => {
    const bd = await clientAs('bd');
    const admin = await clientAs('admin');
    const { data: me } = await bd.auth.getUser();
    const ticket = await newTicket(`QA author ${RUN}`);
    const { data: comment } = await bd
      .from('ticket_comments')
      .insert({ ticket_id: ticket, author_id: me.user!.id, body: 'mine' })
      .select('id')
      .single();
    const { data: changed } = await admin.from('ticket_comments').update({ body: 'not yours' }).eq('id', comment!.id).select('id');
    expect(changed ?? [], 'another staff member cannot edit it').toHaveLength(0);
    await bd.from('ticket_comments').update({ deleted_at: new Date().toISOString() }).eq('id', comment!.id);
    const { data: afterDelete } = await bd.from('ticket_comments').update({ body: 'revived' }).eq('id', comment!.id).select('id');
    expect(afterDelete ?? []).toHaveLength(0);
  });
});
