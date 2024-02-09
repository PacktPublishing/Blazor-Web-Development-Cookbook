namespace BlazorCookbook.App.Client.Chapters.Chapter03.Data;

internal class Ticket
{
    public Guid Id { get; set; }

    public string Title { get; set; }

    public Ticket(string title)
    {
        Id = Guid.NewGuid();
        Title = title;
    }
}
