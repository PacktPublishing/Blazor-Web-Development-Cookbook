namespace BlazorCookbook.App.Client.Chapters.Chapter04.Data;

public abstract record ModelWithKey
{
    public Guid Id { get; init; }
}

public sealed record Ticket : ModelWithKey
{
    public string Tariff { get; set; }

    public decimal Price { get; set; }

    public Ticket(string title, decimal price)
    {
        Id = Guid.NewGuid();
        Tariff = title;
        Price = price;
    }
}

internal static class Tickets
{
    private readonly static List<string> _tariffs = [
        "Adult",
        "Child",
        "Infant",
        "Veteran",
        "Elderly",
        "Guardian",
        "Disabled",
        "Student",
        "Honorary"
    ];

    public readonly static List<Ticket> LargeDataset = GenerateDataset();
    private static List<Ticket> GenerateDataset()
    {
        var randomizer = new Random();
        var tickets = new List<Ticket>();
        for (int i = 0; i < 500; i++)
        {
            var index = randomizer.Next(0, _tariffs.Count);
            var price = Math.Round((decimal)randomizer.NextDouble() * 100, 2);
            tickets.Add(new(_tariffs[index], price));
        }
        return tickets;
    }

    public readonly static List<Ticket> All = [
        new("Adult", 20.00m),
        new("Child", 10.00m),
        new("Infant", 5.00m),
        new("Veteran", 5.00m),
        new("Elderly", 5.00m),
        new("Guardian", 0.00m),
        new("Disabled", 5.00m),
        new("Student", 10.00m),
        new("Honorary", 1.00m)
    ];
}

public sealed class TicketsApi
{
    public async Task<(int, List<Ticket>)> GetAsync(int from, int size, CancellationToken cancellationToken)
    {
        await Task.Delay(200, cancellationToken);

        var data = Tickets
            .LargeDataset
            .Skip(from)
            .Take(size)
            .ToList();

        return (Tickets.LargeDataset.Count, data);
    }

    public IQueryable<Ticket> Get() => Tickets.LargeDataset.AsQueryable();
}