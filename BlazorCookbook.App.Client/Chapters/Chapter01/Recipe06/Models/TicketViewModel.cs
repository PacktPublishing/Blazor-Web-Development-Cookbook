namespace BlazorCookbook.App.Client.Chapters.Chapter01.Recipe06.Models;

public record TicketViewModel
{
    public Guid Id { get; init; }

    public string Tariff { get; init; }

    public string Price { get; init; }

    public TicketViewModel(string tariff, decimal price)
    {
        Id = Guid.NewGuid();
        Tariff = tariff;

        Price = price > 0 ?
                price.ToString("0.00 $")
                : string.Empty;
    }
}