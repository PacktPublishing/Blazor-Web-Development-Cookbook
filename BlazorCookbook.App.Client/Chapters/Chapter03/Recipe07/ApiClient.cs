using BlazorCookbook.App.Client.Chapters.Chapter03.Data;

namespace BlazorCookbook.App.Client.Chapters.Chapter03.Recipe07;

public class ApiClient
{
    public async Task<IList<Ticket>> GetTicketsAsync(CancellationToken cancellationToken)
    {
        await Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);
        return Tickets.All;
    }

    public async Task ShareTicketAsync(Ticket ticket, CancellationToken cancellationToken)
    {
        await Task.Delay(TimeSpan.FromMilliseconds(300), cancellationToken);
    }
}