namespace BlazorCookbook.App.Client.Chapters.Chapter05.Data;

public record Ticket
{
    private static string[] _tariffs = [
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

    public Guid Id { get; init; }
    public string Title { get; init; }

    public Ticket()
    {
        Id = Guid.NewGuid();

        var randomizer = new Random();
        var index = randomizer.Next(0, _tariffs.Length);
        Title = _tariffs[index];
    }

    public Ticket(Guid id) : this()
    {
        Id = id;
    }
}
