namespace BlazorCookbook.App.Client.Chapters.Chapter04.Data;

internal static class Tickets
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

    public static Ticket[] All = [
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

    public static Ticket[] LargeDataset
    {
        get
        {
            var randomizer = new Random();
            var tickets = new List<Ticket>();
            for (int i = 0; i < 500; i++)
            {
                var index = randomizer.Next(0, _tariffs.Length);
                var price = Math.Round((decimal)randomizer.NextDouble() * 100, 2);
                tickets.Add(new(_tariffs[index], price));
            }
            return [.. tickets];
        }
    }
        
        
    

}
