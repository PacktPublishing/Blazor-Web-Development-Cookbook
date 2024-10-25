namespace BlazorCookbook.App.Client.Chapters.Chapter07.Recipe06;

using System.ComponentModel.DataAnnotations;

public class EventNameValidationAttribute : ValidationAttribute
{
    private const string _forbidden = "event";

    private static ValidationResult Failure(string message, string member)
        => new(message, [member]);

    protected override ValidationResult IsValid(object value,
        ValidationContext validationContext)
    {
        var text = value?.ToString();

        if (string.IsNullOrWhiteSpace(text))
            return Failure("You must provide a name.",
                validationContext.MemberName);

        if (text.Contains(_forbidden, StringComparison.InvariantCultureIgnoreCase))
            return Failure("You mustn't use the 'event' keyword.",
                validationContext.MemberName);

        return ValidationResult.Success;
    }
}
