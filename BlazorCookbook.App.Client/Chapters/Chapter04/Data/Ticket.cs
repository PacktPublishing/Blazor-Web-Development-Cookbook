namespace BlazorCookbook.App.Client.Chapters.Chapter04.Data;

public sealed record Ticket
{
    public Guid Id { get; init; }

    public string Tariff { get; set; }

    public decimal Price { get; set; }

    public int Availability { get; set; }

    public bool Enabled { get; set; } = true;

    public Ticket()
    {
        Tariff = string.Empty;
    }

    public Ticket(string title, decimal price)
    {
        Id = Guid.NewGuid();
        Tariff = title;
        Price = price;
    }
}
