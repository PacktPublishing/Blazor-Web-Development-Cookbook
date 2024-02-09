namespace BlazorCookbook.App.Client.Chapters.Chapter03.Data;

internal record Ticket
{
    public Guid Id { get; init; }

    public string Title { get; init; }

    public decimal Price { get; init; }

    public int Availability { get; set; }

    public Ticket(string title, decimal price)
    {
        Id = Guid.NewGuid();
        Title = title;
        Price = price;
    }
}
