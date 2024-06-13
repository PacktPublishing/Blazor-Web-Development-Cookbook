namespace BlazorCookbook.App.Client.Chapters.Chapter03.Data;

internal static class Tickets
{
    public static List<Ticket> All = [
        new("Adult", 20.00m),
        new("Child", 10.00m),
        new("Infant", 5.00m),
        new("Veteran", 5.00m),
        new("Elderly", 5.00m),
        new("Guardian", 0.00m),
        new("Disabled", 5.00m),
        new("Student", 10.00m),
        new("Honorary", 0.00m)
    ];

    public static Task GetAsync(CancellationToken cancellationToken = default)
        => Task.Delay(TimeSpan.FromSeconds(3), cancellationToken);

    public static Task SaveAsync(Ticket ticket, CancellationToken cancellationToken = default)
        => Task.Delay(TimeSpan.FromMilliseconds(500), cancellationToken);
}
