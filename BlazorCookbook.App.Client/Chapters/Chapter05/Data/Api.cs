namespace BlazorCookbook.App.Client.Chapters.Chapter05.Data;

public class Api
{
    public static readonly Guid
        StableEventId = Guid.NewGuid(),
        StableTicketId = Guid.NewGuid();            

    private readonly IList<Event> _source;

    public Api()
    {
        var source = new List<Event>()
        {
            new(StableEventId)
        };

        for (int i = 0; i < 100; i++)
            source.Add(new());

        _source = source;
    }

    public Task<IList<Event>> GetEventsAsync(CancellationToken token)
        => Task.FromResult(_source);

    public Task<Event> GetEventAsync(Guid eventId, CancellationToken token)
        => Task.FromResult(_source.FirstOrDefault(it => it.Id == eventId));

    public Task<IList<Ticket>> GetTicketsAsync(Guid eventId, CancellationToken token)
        => Task.FromResult(_source.FirstOrDefault(it => it.Id == eventId)?.Tickets ?? []);

    public Task<Ticket> GetTicketAsync(Guid eventId, Guid ticketId, CancellationToken token)
        => Task.FromResult(_source.FirstOrDefault(it => it.Id == eventId)?.Tickets.FirstOrDefault(it => it.Id == ticketId));

    public Task SynchronizeAsync(CancellationToken token)
        => Task.Delay(TimeSpan.FromSeconds(3), token);
}
