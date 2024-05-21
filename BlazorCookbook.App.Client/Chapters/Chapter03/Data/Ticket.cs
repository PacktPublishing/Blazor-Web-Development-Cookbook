namespace BlazorCookbook.App.Client.Chapters.Chapter03.Data;

public sealed record Ticket
{
    public Guid Id { get; init; }

    public string Title { get; set; }

    public decimal Price { get; set; }

    public int Availability { get; set; }

    public bool Enabled { get; set; } = true;

    public Ticket()
    {
        Title = string.Empty;
    }

    public Ticket(string title, decimal price)
    {
        Id = Guid.NewGuid();
        Title = title;
        Price = price;
    }
}
